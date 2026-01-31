/**
 * 企业微信 WebSocket 连接
 * 连接云服务器中转站，接收企业微信消息
 */
import WebSocket from "ws";
import type { ChannelGatewayContext, PluginRuntime } from "openclaw/plugin-sdk";
import { getWecomRuntime } from "./runtime.js";
import { sendMessageWecom } from "./send.js";
import { setActiveWecomChat } from "./sync-service.js";

export type WecomWsContext = Pick<
  ChannelGatewayContext,
  "cfg" | "accountId" | "account" | "runtime" | "abortSignal" | "log" | "setStatus"
>;

interface WecomMessageData {
  msgType: string;
  fromUser: string;
  toUser: string;
  content: string;
  msgId: string;
  agentId: string;
  createTime: string;
}

/**
 * 处理企业微信消息
 */
async function handleWecomMessage(params: {
  userId: string;
  content: string;
  msgId: string;
  ctx: WecomWsContext;
  core: PluginRuntime;
}): Promise<void> {
  const { userId, content, msgId, ctx, core } = params;

  const account = ctx.account as {
    accountId: string;
    config: {
      corpId?: string;
      corpSecret?: string;
      agentId?: string;
      dmPolicy?: string;
      allowFrom?: string[];
    };
  };

  // DM 策略验证
  const dmPolicy = account.config.dmPolicy ?? "pairing";
  const configAllowFrom = account.config.allowFrom ?? [];
  
  const storeAllowFrom = await core.channel.pairing
    .readAllowFromStore("wecom")
    .catch(() => []);
  
  const effectiveAllowFrom = Array.from(
    new Set([...configAllowFrom, ...storeAllowFrom])
  );

  if (dmPolicy === "disabled") {
    ctx.log?.debug?.(`[wecom] DM 被禁用`);
    return;
  }

  if (dmPolicy !== "open") {
    const senderAllowed = effectiveAllowFrom.includes(userId);
    if (!senderAllowed) {
      if (dmPolicy === "pairing") {
        try {
          const { code, created } = await core.channel.pairing.upsertPairingRequest({
            channel: "wecom",
            id: userId,
            meta: { name: userId },
          });

          if (created) {
            const pairingMsg = core.channel.pairing.buildPairingReply({
              channel: "wecom",
              idLine: `Your WeCom user id: ${userId}`,
              code,
            });
            await sendMessageWecom(`user:${userId}`, pairingMsg, {
              cfg: ctx.cfg,
              accountId: account.accountId,
            });
          }
        } catch (err) {
          ctx.log?.error?.(`[wecom] 配对请求失败: ${String(err)}`);
        }
      }
      ctx.log?.debug?.(`[wecom] 发送者 ${userId} 未授权`);
      return;
    }
  }

  // 设置活跃聊天
  setActiveWecomChat({
    userId,
    accountId: account.accountId,
    lastMessageId: msgId,
  }, ctx.cfg);

  // 解析路由
  const route = core.channel.routing.resolveAgentRoute({
    cfg: ctx.cfg,
    channel: "wecom",
    accountId: account.accountId,
    peer: {
      kind: "dm",
      id: userId,
    },
  });

  // 构建 InboundContext
  const timestamp = Date.now();
  const sessionKey = route.sessionKey;
  const from = `wecom:${userId}`;
  const to = `user:${userId}`;

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: content,
    RawBody: content,
    CommandBody: content,
    From: from,
    To: to,
    SessionKey: sessionKey,
    AccountId: route.accountId,
    ChatType: "direct" as const,
    ConversationLabel: `企业微信用户 ${userId}`,
    SenderName: userId,
    SenderId: userId,
    Provider: "wecom" as const,
    Surface: "wecom" as const,
    MessageSid: msgId,
    Timestamp: timestamp,
    WasMentioned: false,
    CommandAuthorized: true,
    OriginatingChannel: "wecom" as const,
    OriginatingTo: to,
  });

  // 发送"正在思考"提示
  try {
    await sendMessageWecom(to, "🤔 正在思考...", {
      cfg: ctx.cfg,
      accountId: account.accountId,
    });
  } catch (err) {
    ctx.log?.warn?.(`[wecom] 发送思考提示失败: ${String(err)}`);
  }

  // 创建 ReplyDispatcher
  const tableMode = core.channel.text.resolveMarkdownTableMode(ctx.cfg);
  const textLimit = 2048;

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: undefined,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(ctx.cfg, route.agentId),
      deliver: async (payload) => {
        const replyText = payload.text ?? "";
        const converted = core.channel.text.convertMarkdownTables(replyText, tableMode);
        const chunks = core.channel.text.chunkMarkdownText(converted, textLimit);

        for (const chunk of chunks) {
          await sendMessageWecom(to, chunk, {
            cfg: ctx.cfg,
            accountId: account.accountId,
          });
        }
      },
      onError: (err, info) => {
        ctx.log?.error?.(`[wecom] ${info.kind} reply failed: ${String(err)}`);
      },
    });

  // 调用 AI 处理
  ctx.log?.info?.(`[wecom] 调用 AI 处理消息: ${content.slice(0, 50)}...`);
  await core.channel.reply.dispatchReplyFromConfig({
    ctx: ctxPayload,
    cfg: ctx.cfg,
    dispatcher,
    replyOptions,
  });

  markDispatchIdle();
  ctx.log?.info?.(`[wecom] AI 处理完成`);
}

/**
 * 启动 WebSocket 连接
 */
export async function startWecomWs(ctx: WecomWsContext): Promise<void> {
  const account = ctx.account as {
    config: {
      corpId?: string;
      corpSecret?: string;
      agentId?: string;
      relayServer?: string;
    };
  };

  const relayServer = account.config?.relayServer;

  if (!relayServer) {
    ctx.log?.warn?.("[wecom] 未配置 relayServer，WebSocket 不启动");
    ctx.log?.info?.("[wecom] 请配置 channels.wecom.relayServer 为云服务器地址，如 wss://openclawwx.metaseek.cc:3004");
    return;
  }

  const core = getWecomRuntime();
  let ws: WebSocket | null = null;
  let isStopped = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connect = () => {
    if (isStopped) return;

    ctx.log?.info?.(`[wecom] 正在连接中转服务器: ${relayServer}`);

    ws = new WebSocket(relayServer);

    ws.on("open", () => {
      ctx.log?.info?.("[wecom] 已连接到中转服务器");
      ctx.setStatus?.({ accountId: ctx.accountId, running: true, lastError: null });
    });

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === "connected") {
          ctx.log?.info?.(`[wecom] 中转服务器: ${msg.data?.message}`);
          return;
        }

        if (msg.type === "pong") {
          return;
        }

        if (msg.type === "message" && msg.data) {
          const msgData = msg.data as WecomMessageData;
          
          if (msgData.msgType === "text" && msgData.content) {
            ctx.log?.info?.(`[wecom] 收到消息: from=${msgData.fromUser}, content=${msgData.content.slice(0, 30)}...`);
            
            handleWecomMessage({
              userId: msgData.fromUser,
              content: msgData.content,
              msgId: msgData.msgId || `${Date.now()}`,
              ctx,
              core,
            }).catch((err) => {
              ctx.log?.error?.(`[wecom] 处理消息失败: ${String(err)}`);
            });
          }
        }
      } catch (err) {
        ctx.log?.error?.(`[wecom] 解析消息失败: ${String(err)}`);
      }
    });

    ws.on("close", () => {
      ctx.log?.warn?.("[wecom] 连接断开");
      ctx.setStatus?.({ accountId: ctx.accountId, running: false });
      
      // 重连
      if (!isStopped) {
        ctx.log?.info?.("[wecom] 5 秒后重连...");
        reconnectTimer = setTimeout(connect, 5000);
      }
    });

    ws.on("error", (err) => {
      ctx.log?.error?.(`[wecom] WebSocket 错误: ${err.message}`);
    });

    // 心跳
    const heartbeat = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    ws.on("close", () => clearInterval(heartbeat));
  };

  // 处理停止
  const onAbort = () => {
    if (isStopped) return;
    isStopped = true;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }

    if (ws) {
      ws.close();
    }

    ctx.log?.info?.("[wecom] WebSocket 已停止");
    ctx.setStatus?.({ accountId: ctx.accountId, running: false });
  };

  if (ctx.abortSignal?.aborted) {
    onAbort();
    return;
  }
  ctx.abortSignal?.addEventListener?.("abort", onAbort);

  // 开始连接
  connect();

  // 等待停止
  await new Promise<void>((resolve) => {
    if (ctx.abortSignal?.aborted) {
      resolve();
      return;
    }
    ctx.abortSignal?.addEventListener?.("abort", () => resolve());
  });
  onAbort();
}
