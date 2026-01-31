/**
 * 企业微信频道插件
 */
import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { getWecomRuntime } from "./runtime.js";
import { startWecomCallback } from "./wecom-callback.js";
import { sendMessageWecom } from "./send.js";

export interface WecomAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  config: {
    corpId?: string;
    corpSecret?: string;
    agentId?: string;
    token?: string;
    encodingAESKey?: string;
    callbackPort?: number;
    enabled?: boolean;
    dmPolicy?: string;
    allowFrom?: string[];
  };
}

export const wecomPlugin: ChannelPlugin<WecomAccount> = {
  id: "wecom",
  meta: {
    id: "wecom",
    name: "企业微信",
    description: "企业微信频道 (WeCom/WeChat Work)",
    icon: "💼",
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: true, // 企业微信不支持流式
  },
  reload: { configPrefixes: ["channels.wecom"] },
  configSchema: {
    type: "object",
    properties: {
      wecom: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          corpId: { type: "string", description: "企业 ID" },
          corpSecret: { type: "string", description: "应用 Secret" },
          agentId: { type: "string", description: "应用 AgentId" },
          token: { type: "string", description: "回调 Token" },
          encodingAESKey: { type: "string", description: "回调 EncodingAESKey" },
          callbackPort: { type: "number", description: "回调服务端口，默认 3003" },
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
      const wecomConfig = cfg.channels?.wecom as any;
      return {
        accountId: "default",
        name: "企业微信",
        enabled: wecomConfig?.enabled !== false,
        config: {
          corpId: wecomConfig?.corpId,
          corpSecret: wecomConfig?.corpSecret,
          agentId: wecomConfig?.agentId,
          token: wecomConfig?.token,
          encodingAESKey: wecomConfig?.encodingAESKey,
          callbackPort: wecomConfig?.callbackPort,
          enabled: wecomConfig?.enabled,
          dmPolicy: wecomConfig?.dmPolicy,
          allowFrom: wecomConfig?.allowFrom,
        },
      };
    },
    defaultAccountId: () => "default",
    setAccountEnabled: ({ cfg, enabled }) => {
      if (!cfg.channels) cfg.channels = {};
      if (!cfg.channels.wecom) cfg.channels.wecom = {};
      (cfg.channels.wecom as any).enabled = enabled;
      return cfg;
    },
    deleteAccount: ({ cfg }) => {
      if (cfg.channels?.wecom) {
        delete cfg.channels.wecom;
      }
      return cfg;
    },
    isConfigured: (account) => {
      return Boolean(
        account.config.corpId &&
        account.config.corpSecret &&
        account.config.agentId &&
        account.config.token &&
        account.config.encodingAESKey
      );
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(
        account.config.corpId &&
        account.config.corpSecret &&
        account.config.agentId
      ),
    }),
    resolveAllowFrom: ({ cfg }) => {
      const wecomConfig = cfg.channels?.wecom as any;
      return wecomConfig?.allowFrom ?? [];
    },
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean),
  },
  security: {
    resolveDmPolicy: ({ cfg, account }) => ({
      policy: (account.config as any).dmPolicy ?? "pairing",
      allowFrom: (cfg.channels?.wecom as any)?.allowFrom ?? [],
      policyPath: "channels.wecom.dmPolicy",
      allowFromPath: "channels.wecom.",
      approveHint: "openclaw pairing approve wecom <code>",
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
      throw new Error("企业微信使用 corpId/corpSecret 配置，无需 login");
    },
    logout: async () => {
      throw new Error("企业微信使用 corpId/corpSecret 配置，无需 logout");
    },
    start: async ({ account }) => {
      if (!account.config.corpId || !account.config.corpSecret) {
        throw new Error("企业微信未配置 corpId 或 corpSecret");
      }
      return { success: true };
    },
    stop: async () => {
      return { success: true };
    },
    send: async ({ target, blocks, cfg, accountId }) => {
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

      const to = target.chatId || "";
      await sendMessageWecom(to, text, {
        cfg,
        accountId: accountId || "default",
      });

      return {
        messageId: `wecom_${Date.now()}`,
        timestamp: Date.now(),
      };
    },
    edit: async () => {
      throw new Error("企业微信暂不支持编辑消息");
    },
    delete: async () => {
      throw new Error("企业微信暂不支持删除消息");
    },
    react: async () => {
      throw new Error("企业微信暂不支持表情回应");
    },
  },
  messageActions: {
    listActions: () => [],
    extractToolSend: () => null,
    handleAction: async () => {
      throw new Error("企业微信暂不支持消息操作");
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account as WecomAccount;
      ctx.setStatus?.({ accountId: account.accountId, running: true, lastError: null });
      ctx.log?.info?.(`[wecom] 启动回调服务器 (account=${account.accountId})`);
      return startWecomCallback(ctx);
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 2048, // 企业微信文本消息限制
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
        let splitAt = remaining.lastIndexOf("\n", limit);
        if (splitAt <= 0) splitAt = limit;
        chunks.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt).trimStart();
      }
      return chunks;
    },
    chunkerMode: "markdown",
    sendText: async ({ to, text, accountId, cfg, replyToId }) => {
      await sendMessageWecom(to, text, {
        cfg,
        accountId: accountId || "default",
        replyToId,
      });
      return { channel: "wecom", messageId: `wecom_${Date.now()}` };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, cfg, replyToId }) => {
      const messageText = text || (mediaUrl ? `[媒体: ${mediaUrl}]` : "");
      if (messageText) {
        await sendMessageWecom(to, messageText, {
          cfg,
          accountId: accountId || "default",
          replyToId,
        });
      }
      return { channel: "wecom", messageId: `wecom_${Date.now()}` };
    },
    resolveTarget: ({ to }) => {
      const trimmed = to?.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("user:") || trimmed.startsWith("chat:")) {
        return { to: trimmed };
      }
      // 假定为用户 ID
      return { to: `user:${trimmed}` };
    },
  },
};
