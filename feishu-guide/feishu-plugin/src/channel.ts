import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { getFeishuRuntime } from "./runtime.js";
import { startFeishuWs } from "./feishu-ws.js";
import { sendMessageFeishu } from "./send.js";

export interface FeishuAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  config: {
    appId?: string;
    appSecret?: string;
    enabled?: boolean;
    dmPolicy?: string;
    allowFrom?: string[];
  };
}

export const feishuPlugin: ChannelPlugin<FeishuAccount> = {
  id: "feishu",
  meta: {
    id: "feishu",
    name: "飞书",
    description: "飞书频道 (Feishu/Lark)",
    icon: "🪽",
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ["channels.feishu"] },
  configSchema: {
    type: "object",
    properties: {
      feishu: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          appId: { type: "string" },
          appSecret: { type: "string" },
          allowFrom: {
            type: "array",
            items: { type: "string" },
          },
          dmPolicy: {
            type: "string",
            enum: ["pairing", "allowlist", "open"],
          },
        },
      },
    },
  },
  config: {
    listAccountIds: (cfg) => ["default"],
    resolveAccount: (cfg, accountId) => {
      const feishuConfig = cfg.channels?.feishu as any;
      return {
        accountId: "default",
        name: "飞书",
        enabled: feishuConfig?.enabled !== false,
        config: {
          appId: feishuConfig?.appId,
          appSecret: feishuConfig?.appSecret,
          enabled: feishuConfig?.enabled,
          dmPolicy: feishuConfig?.dmPolicy,
          allowFrom: feishuConfig?.allowFrom,
        },
      };
    },
    defaultAccountId: () => "default",
    setAccountEnabled: ({ cfg, enabled }) => {
      if (!cfg.channels) cfg.channels = {};
      if (!cfg.channels.feishu) cfg.channels.feishu = {};
      (cfg.channels.feishu as any).enabled = enabled;
      return cfg;
    },
    deleteAccount: ({ cfg }) => {
      if (cfg.channels?.feishu) {
        delete cfg.channels.feishu;
      }
      return cfg;
    },
    isConfigured: (account) => {
      return Boolean(account.config.appId && account.config.appSecret);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.config.appId && account.config.appSecret),
    }),
    resolveAllowFrom: ({ cfg }) => {
      const feishuConfig = cfg.channels?.feishu as any;
      return feishuConfig?.allowFrom ?? [];
    },
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean),
  },
  security: {
    resolveDmPolicy: ({ cfg, account }) => ({
      policy: (account.config as any).dmPolicy ?? "pairing",
      allowFrom: (cfg.channels?.feishu as any)?.allowFrom ?? [],
      policyPath: "channels.feishu.dmPolicy",
      allowFromPath: "channels.feishu.",
      approveHint: "openclaw pairing approve feishu <code>",
      normalizeEntry: (raw) => raw.trim(),
    }),
    collectWarnings: () => [],
  },
  directory: {
    listGroups: () => [],
    listPeers: () => [],
  },
  actions: {
    login: async () => {
      throw new Error("飞书使用 appId/appSecret 配置，无需 login");
    },
    logout: async () => {
      throw new Error("飞书使用 appId/appSecret 配置，无需 logout");
    },
    start: async ({ account }) => {
      const runtime = getFeishuRuntime();
      if (!account.config.appId || !account.config.appSecret) {
        throw new Error("飞书未配置 appId 或 appSecret");
      }
      // TODO: 初始化飞书客户端
      return { success: true };
    },
    stop: async () => {
      // TODO: 清理飞书客户端
      return { success: true };
    },
    send: async ({ target, blocks, cfg, accountId }) => {
      const runtime = getFeishuRuntime();
      
      // 将 blocks 转换为文本
      let text = "";
      for (const block of blocks) {
        if (block.type === "text") {
          text += block.text + "\n";
        } else if (block.type === "markdown") {
          text += block.markdown + "\n";
        }
      }
      text = text.trim();
      
      if (!text) {
        throw new Error("消息内容为空");
      }
      
      // 发送消息
      const to = target.chatId?.startsWith("ou_") 
        ? `user:${target.chatId}` 
        : target.chatId || "";
      
      await sendMessageFeishu(to, text, {
        cfg,
        accountId: accountId || "default",
      });
      
      return {
        messageId: `feishu_${Date.now()}`,
        timestamp: Date.now(),
      };
    },
    edit: async () => {
      throw new Error("飞书暂不支持编辑消息");
    },
    delete: async () => {
      throw new Error("飞书暂不支持删除消息");
    },
    react: async () => {
      throw new Error("飞书暂不支持表情回应");
    },
  },
  messageActions: {
    listActions: () => [],
    extractToolSend: () => null,
    handleAction: async () => {
      throw new Error("飞书暂不支持消息操作");
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account as FeishuAccount;
      ctx.setStatus?.({ accountId: account.accountId, running: true, lastError: null });
      ctx.log?.info?.(`[feishu] 启动长连接 (account=${account.accountId})`);
      return startFeishuWs(ctx);
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4000,
    chunker: (text, limit) => {
      if (!text) return [];
      if (limit <= 0 || text.length <= limit) return [text];
      const chunks: string[] = [];
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= limit) {
          chunks.push(remaining);
          break;
        }
        // 在换行符处分割
        let splitAt = remaining.lastIndexOf("\n", limit);
        if (splitAt <= 0) splitAt = limit;
        chunks.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt).trimStart();
      }
      return chunks;
    },
    chunkerMode: "markdown",
    sendText: async ({ to, text, accountId, cfg, replyToId }) => {
      // 解析目标
      let targetId = to;
      if (to.startsWith("user:")) {
        targetId = to;
      } else if (to.startsWith("ou_")) {
        targetId = `user:${to}`;
      }
      
      await sendMessageFeishu(targetId, text, {
        cfg,
        accountId: accountId || "default",
        replyToId,
      });
      
      return { channel: "feishu", messageId: `feishu_${Date.now()}` };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, cfg, replyToId }) => {
      // 飞书暂时只发送文本，忽略媒体
      let targetId = to;
      if (to.startsWith("user:")) {
        targetId = to;
      } else if (to.startsWith("ou_")) {
        targetId = `user:${to}`;
      }
      
      const messageText = text || (mediaUrl ? `[媒体: ${mediaUrl}]` : "");
      if (messageText) {
        await sendMessageFeishu(targetId, messageText, {
          cfg,
          accountId: accountId || "default",
          replyToId,
        });
      }
      
      return { channel: "feishu", messageId: `feishu_${Date.now()}` };
    },
    resolveTarget: ({ to }) => {
      const trimmed = to?.trim();
      if (!trimmed) return null;
      // 支持 user:xxx 或直接的 open_id
      if (trimmed.startsWith("user:") || trimmed.startsWith("ou_") || trimmed.startsWith("oc_")) {
        return { to: trimmed };
      }
      return null;
    },
  },
};
