import type { ChannelPlugin } from "clawdbot/plugin-sdk";
import { getFeishuRuntime } from "./runtime.js";
import { startFeishuWs } from "./feishu-ws.js";

export interface FeishuAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  config: {
    appId?: string;
    appSecret?: string;
    enabled?: boolean;
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
      approveHint: "clawdbot pairing approve feishu <code>",
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
    send: async ({ target, blocks }) => {
      const runtime = getFeishuRuntime();
      // TODO: 实现发送消息逻辑
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
};
