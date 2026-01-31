/**
 * 飞书长连接 (WebSocket) 接收事件
 * 文档：https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/subscribe-to-events
 * 选择「使用长连接接收事件」时，无需公网域名、无需加密策略，事件通过 SDK 的 WebSocket 通道推送。
 */
import * as Lark from "@larksuiteoapi/node-sdk";
import type { ChannelGatewayContext, PluginRuntime } from "clawdbot/plugin-sdk";
import { getFeishuRuntime } from "./runtime.js";
import { sendMessageFeishu } from "./send.js";

export type FeishuWsContext = Pick<
  ChannelGatewayContext,
  "cfg" | "accountId" | "account" | "runtime" | "abortSignal" | "log" | "setStatus"
>;

type FeishuMessageEntry = {
  chatId: string;
  senderId: string;
  chatType?: string;
  text: string;
  messageId: string;
  messageType: string;
  rawContent: string;
};

/**
 * 处理飞书消息，调用 AI 并回复
 */
async function handleFeishuMessage(params: {
  chatId: string;
  senderId: string;
  chatType?: string;
  text: string;
  messageId: string;
  ctx: FeishuWsContext;
  core: PluginRuntime;
}): Promise<void> {
  const { chatId, senderId, chatType, text, messageId, ctx, core } = params;

  // 1. 获取账户配置
  const account = ctx.account as {
    accountId: string;
    config: {
      appId?: string;
      appSecret?: string;
      dmPolicy?: string;
      allowFrom?: string[];
    };
  };

  // 2. dmPolicy 验证
  const dmPolicy = account.config.dmPolicy ?? "pairing";
  const configAllowFrom = account.config.allowFrom ?? [];
  
  // 读取存储的 allowFrom
  const storeAllowFrom = await core.channel.pairing
    .readAllowFromStore("feishu")
    .catch(() => []);
  
  const effectiveAllowFrom = Array.from(
    new Set([...configAllowFrom, ...storeAllowFrom])
  );

  // DM 策略检查
  if (dmPolicy === "disabled") {
    ctx.log?.debug?.(`[feishu] DM 被禁用，丢弃消息`);
    return;
  }

  if (dmPolicy !== "open") {
    const senderAllowed = effectiveAllowFrom.includes(senderId);
    if (!senderAllowed) {
      if (dmPolicy === "pairing") {
        // 发送配对请求
        try {
          const { code, created } = await core.channel.pairing.upsertPairingRequest({
            channel: "feishu",
            id: senderId,
            meta: { name: senderId },
          });

          if (created) {
            const pairingMsg = core.channel.pairing.buildPairingReply({
              channel: "feishu",
              idLine: `Your Feishu user id: ${senderId}`,
              code,
            });
            await sendMessageFeishu(`user:${senderId}`, pairingMsg, {
              cfg: ctx.cfg,
              accountId: account.accountId,
            });
          }
        } catch (err) {
          ctx.log?.error?.(`[feishu] 配对请求失败: ${String(err)}`);
        }
      }
      ctx.log?.debug?.(`[feishu] 发送者 ${senderId} 未授权，丢弃消息`);
      return;
    }
  }

  // 3. 判断是否为群聊
  // 优先使用飞书事件的 chat_type（p2p 表示私聊）
  const isGroupChat = chatType ? chatType !== "p2p" : chatId !== senderId;
  const resolvedChatType = isGroupChat ? "group" : "direct";

  // 解析路由
  const route = core.channel.routing.resolveAgentRoute({
    cfg: ctx.cfg,
    channel: "feishu",
    accountId: account.accountId,
    peer: {
      kind: isGroupChat ? "group" : "dm",
      id: isGroupChat ? chatId : senderId,
    },
  });

  // 4. 构建 InboundContext
  const timestamp = Date.now();
  const sessionKey = `feishu:${account.accountId}:${chatId}`;
  const from = `feishu:${senderId}`;
  // 如果是群聊，回复到群；如果是私聊，回复给用户
  const to = isGroupChat ? chatId : `user:${senderId}`;

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: text,
    RawBody: text,
    CommandBody: text,
    From: from,
    To: to,
    SessionKey: sessionKey,
    AccountId: route.accountId,
    ChatType: resolvedChatType as const,
    ConversationLabel: isGroupChat ? `飞书群聊 ${chatId}` : `飞书用户 ${senderId}`,
    SenderName: senderId,
    SenderId: senderId,
    Provider: "feishu" as const,
    Surface: "feishu" as const,
    MessageSid: messageId,
    Timestamp: timestamp,
    WasMentioned: false,
    CommandAuthorized: true,
    OriginatingChannel: "feishu" as const,
    OriginatingTo: to,
  });

  // 5. 创建 ReplyDispatcher
  const tableMode = core.channel.text.resolveMarkdownTableMode(ctx.cfg);
  const textLimit = 4000; // 飞书单条消息限制

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: undefined,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(ctx.cfg, route.agentId),
      deliver: async (payload) => {
        const replyText = payload.text ?? "";
        const converted = core.channel.text.convertMarkdownTables(replyText, tableMode);
        const chunks = core.channel.text.chunkMarkdownText(converted, textLimit);

        for (const chunk of chunks) {
          await sendMessageFeishu(to, chunk, {
            cfg: ctx.cfg,
            accountId: account.accountId,
            replyToId: messageId,
          });
        }
      },
      onError: (err, info) => {
        ctx.log?.error?.(`[feishu] ${info.kind} reply failed: ${String(err)}`);
      },
    });

  // 6. 调用 AI 处理并发送回复
  ctx.log?.info?.(`[feishu] 调用 AI 处理消息...`);
  await core.channel.reply.dispatchReplyFromConfig({
    ctx: ctxPayload,
    cfg: ctx.cfg,
    dispatcher,
    replyOptions,
  });
  markDispatchIdle();
  ctx.log?.info?.(`[feishu] AI 处理完成`);
}

export async function startFeishuWs(ctx: FeishuWsContext): Promise<void> {
  const account = ctx.account as { config: { appId?: string; appSecret?: string } };
  const appId = account.config?.appId;
  const appSecret = account.config?.appSecret;

  if (!appId || !appSecret) {
    ctx.log?.warn?.("[feishu] 未配置 appId 或 appSecret，长连接不启动");
    return;
  }

  const baseConfig = { appId, appSecret };
  const wsClient = new Lark.WSClient({
    ...baseConfig,
    loggerLevel: Lark.LoggerLevel.info,
  });

  ctx.log?.info?.("[feishu] 正在启动长连接…");

  const onAbort = (): void => {
    try {
      wsClient.stop();
      ctx.log?.info?.("[feishu] 长连接已停止");
    } catch (err) {
      ctx.log?.error?.(`[feishu] 停止长连接失败: ${String(err)}`);
    }
    ctx.setStatus?.({ accountId: ctx.accountId, running: false });
  };

  if (ctx.abortSignal?.aborted) {
    onAbort();
    return;
  }
  ctx.abortSignal?.addEventListener?.("abort", onAbort);

  // 获取核心 runtime 功能
  const core = getFeishuRuntime();

  // 解析防抖时间
  const inboundDebounceMs = core.channel.debounce.resolveInboundDebounceMs({
    cfg: ctx.cfg,
    channel: "feishu",
  });

  ctx.log?.debug?.(`[feishu] 防抖时间: ${inboundDebounceMs}ms`);

  // 创建防抖器
  const inboundDebouncer = core.channel.debounce.createInboundDebouncer<FeishuMessageEntry>({
    debounceMs: inboundDebounceMs,
    buildKey: (entry) => `feishu:${ctx.accountId}:${entry.chatId}:${entry.senderId}`,
    shouldDebounce: (entry) => {
      if (!entry.text.trim()) return false;
      // 控制命令不防抖
      return !core.channel.text.hasControlCommand(entry.text, ctx.cfg);
    },
    onFlush: async (entries) => {
      const last = entries.at(-1);
      if (!last) return;

      const text =
        entries.length === 1
          ? last.text
          : entries
              .map((e) => e.text)
              .filter(Boolean)
              .join("\n");

      ctx.log?.info?.(
        `[feishu] 处理 ${entries.length} 条消息 chat=${last.chatId} from=${last.senderId} len=${text.length}`,
      );

      try {
        await handleFeishuMessage({
          chatId: last.chatId,
          chatType: last.chatType,
          senderId: last.senderId,
          text,
          messageId: last.messageId,
          ctx,
          core,
        });
      } catch (err) {
        ctx.log?.error?.(`[feishu] 消息处理失败: ${String(err)}`);
      }
    },
    onError: (err) => {
      ctx.log?.error?.(`[feishu] debounce flush 失败: ${String(err)}`);
    },
  });

  // 启动长连接
  wsClient
    .start({
      eventDispatcher: new Lark.EventDispatcher({}).register({
        "im.message.receive_v1": async (data: {
          message?: {
            chat_id?: string;
            message_id?: string;
            content?: string;
            message_type?: string;
            chat_type?: string;
          };
          sender?: { sender_id?: { user_id?: string; open_id?: string }; sender_type?: string };
        }) => {
          const message = data?.message;
          const sender = data?.sender;
          if (!message || !sender) {
            ctx.log?.warn?.("[feishu] 消息缺少 message 或 sender");
            return;
          }

          const chatId = message.chat_id ?? "";
          const chatType = message.chat_type ?? "";
          const senderId = sender.sender_id?.user_id ?? sender.sender_id?.open_id ?? "";
          const messageId = message.message_id ?? "";
          const messageType = message.message_type ?? "";
          const rawContent = message.content ?? "";

          let text = "";
          try {
            const content = JSON.parse(rawContent);
            text = content.text ?? "";
          } catch {
            text = rawContent;
          }

          ctx.log?.info?.(
            `[feishu] 收到消息 chat=${chatId} from=${senderId} type=${messageType} chatType=${chatType} len=${text.length}`,
          );

          try {
            await inboundDebouncer.enqueue({
              chatId,
              chatType,
              senderId,
              text,
              messageId,
              messageType,
              rawContent,
            });
          } catch (err) {
            ctx.log?.error?.(`[feishu] 入站投递失败: ${String(err)}`);
          }
        },
      }),
    })
    .then(() => {
      ctx.log?.info?.("[feishu] 长连接已连接");
      ctx.setStatus?.({ accountId: ctx.accountId, running: true, lastError: null });
    })
    .catch((err: unknown) => {
      ctx.log?.error?.(`[feishu] 长连接启动失败: ${String(err)}`);
      ctx.setStatus?.({ accountId: ctx.accountId, running: false, lastError: String(err) });
      throw err;
    });

  // 等待 abort，否则 startAccount 会一直挂起（长连接保持）
  await new Promise<void>((resolve) => {
    if (ctx.abortSignal?.aborted) {
      resolve();
      return;
    }
    ctx.abortSignal?.addEventListener?.("abort", () => resolve());
  });
  onAbort();
}
