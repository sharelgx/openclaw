/**
 * 企业微信 HTTP 回调服务器
 * 用于接收企业微信推送的消息和事件
 */
import http from "http";
import { URL } from "url";
import { parseStringPromise } from "xml2js";
import type { ChannelGatewayContext, PluginRuntime } from "openclaw/plugin-sdk";
import { WecomCrypto, generateNonce, getTimestamp } from "./wecom-crypto.js";
import { getWecomRuntime } from "./runtime.js";
import { sendMessageWecom } from "./send.js";
import { setActiveWecomChat } from "./sync-service.js";

export type WecomCallbackContext = Pick<
  ChannelGatewayContext,
  "cfg" | "accountId" | "account" | "runtime" | "abortSignal" | "log" | "setStatus"
>;

interface WecomMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: string;
  MsgType: string;
  Content?: string;
  MsgId?: string;
  AgentID?: string;
  Event?: string;
  EventKey?: string;
}

/**
 * 处理企业微信消息
 */
async function handleWecomMessage(params: {
  userId: string;
  content: string;
  msgId: string;
  agentId: string;
  ctx: WecomCallbackContext;
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
    ctx.log?.debug?.(`[wecom] DM 被禁用，丢弃消息`);
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
      ctx.log?.debug?.(`[wecom] 发送者 ${userId} 未授权，丢弃消息`);
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
  const textLimit = 2048; // 企业微信文本消息限制

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
  ctx.log?.info?.(`[wecom] 调用 AI 处理消息...`);
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
 * 启动企业微信回调服务器
 */
export async function startWecomCallback(ctx: WecomCallbackContext): Promise<void> {
  const account = ctx.account as {
    config: {
      corpId?: string;
      corpSecret?: string;
      agentId?: string;
      token?: string;
      encodingAESKey?: string;
      callbackPort?: number;
    };
  };

  const { corpId, token, encodingAESKey, callbackPort } = account.config;

  if (!corpId || !token || !encodingAESKey) {
    ctx.log?.warn?.("[wecom] 缺少必要配置 (corpId/token/encodingAESKey)，回调服务不启动");
    return;
  }

  const port = callbackPort || 3003;
  const crypto = new WecomCrypto({ token, encodingAESKey, corpId });
  const core = getWecomRuntime();

  let isStopped = false;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      const path = url.pathname;

      // 健康检查
      if (path === "/health") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
        return;
      }

      // 企业微信回调
      if (path === "/callback" || path === "/") {
        const msgSignature = url.searchParams.get("msg_signature") || "";
        const timestamp = url.searchParams.get("timestamp") || "";
        const nonce = url.searchParams.get("nonce") || "";

        // GET 请求: 验证 URL
        if (req.method === "GET") {
          const echostr = url.searchParams.get("echostr") || "";
          
          if (!crypto.verifySignature(msgSignature, timestamp, nonce, echostr)) {
            ctx.log?.warn?.("[wecom] URL 验证签名失败");
            res.writeHead(403);
            res.end("Invalid signature");
            return;
          }

          const decrypted = crypto.decryptEchoStr(echostr);
          ctx.log?.info?.("[wecom] URL 验证成功");
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(decrypted);
          return;
        }

        // POST 请求: 接收消息
        if (req.method === "POST") {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
          }

          // 解析 XML
          const xml = await parseStringPromise(body, { explicitArray: false });
          const encrypt = xml?.xml?.Encrypt;

          if (!encrypt) {
            ctx.log?.warn?.("[wecom] 消息缺少 Encrypt 字段");
            res.writeHead(400);
            res.end("Missing Encrypt");
            return;
          }

          // 验证签名
          if (!crypto.verifySignature(msgSignature, timestamp, nonce, encrypt)) {
            ctx.log?.warn?.("[wecom] 消息签名验证失败");
            res.writeHead(403);
            res.end("Invalid signature");
            return;
          }

          // 解密消息
          const decrypted = crypto.decrypt(encrypt);
          const msgXml = await parseStringPromise(decrypted, { explicitArray: false });
          const msg = msgXml?.xml as WecomMessage;

          ctx.log?.info?.(`[wecom] 收到消息: type=${msg.MsgType} from=${msg.FromUserName}`);

          // 只处理文本消息
          if (msg.MsgType === "text" && msg.Content) {
            // 异步处理，立即返回
            handleWecomMessage({
              userId: msg.FromUserName,
              content: msg.Content,
              msgId: msg.MsgId || `${Date.now()}`,
              agentId: msg.AgentID || "",
              ctx,
              core,
            }).catch((err) => {
              ctx.log?.error?.(`[wecom] 处理消息失败: ${String(err)}`);
            });
          }

          // 返回空响应（企业微信要求 5 秒内响应）
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("");
          return;
        }
      }

      // 404
      res.writeHead(404);
      res.end("Not Found");
    } catch (err) {
      ctx.log?.error?.(`[wecom] 回调处理错误: ${String(err)}`);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  });

  // 启动服务器
  await new Promise<void>((resolve, reject) => {
    server.listen(port, () => {
      ctx.log?.info?.(`[wecom] 回调服务器已启动，监听端口 ${port}`);
      ctx.setStatus?.({ accountId: ctx.accountId, running: true, lastError: null });
      resolve();
    });
    server.on("error", reject);
  });

  // 处理停止信号
  const onAbort = () => {
    if (isStopped) return;
    isStopped = true;

    server.close(() => {
      ctx.log?.info?.("[wecom] 回调服务器已停止");
    });
    ctx.setStatus?.({ accountId: ctx.accountId, running: false });
  };

  if (ctx.abortSignal?.aborted) {
    onAbort();
    return;
  }
  ctx.abortSignal?.addEventListener?.("abort", onAbort);

  // 等待停止信号
  await new Promise<void>((resolve) => {
    if (ctx.abortSignal?.aborted) {
      resolve();
      return;
    }
    ctx.abortSignal?.addEventListener?.("abort", () => resolve());
  });
  onAbort();
}
