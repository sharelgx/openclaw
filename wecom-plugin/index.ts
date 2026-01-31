/**
 * 企业微信插件入口
 */
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { wecomPlugin } from "./src/channel.js";
import { setWecomRuntime } from "./src/runtime.js";
import { getActiveWecomChat, syncMessageToWecom, getWecomConfig } from "./src/sync-service.js";
import {
  createReadWecomSheetTool,
  createReadWecomDocTool,
  createGetCustomerListTool,
  createGetCustomerDetailTool,
  setToolConfig,
} from "./src/wecom-tools.js";

// 全局错误处理
process.on("uncaughtException", (err) => {
  if (err.message?.includes("ECONNRESET") || err.message?.includes("ETIMEDOUT")) {
    console.log("[wecom-plugin] 忽略网络超时错误");
    return;
  }
  console.error("[wecom-plugin] 未捕获的异常:", err.message);
});

process.on("unhandledRejection", (reason) => {
  const msg = String(reason);
  if (msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT")) {
    console.log("[wecom-plugin] 忽略网络相关的 Promise 拒绝");
    return;
  }
  console.error("[wecom-plugin] 未处理的 Promise 拒绝:", msg);
});

const plugin = {
  id: "wecom",
  name: "企业微信",
  description: "企业微信频道插件 (WeCom)，支持消息收发、智能表格读取、客户信息查询",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWecomRuntime(api.runtime);
    api.registerChannel({ plugin: wecomPlugin });

    // 注册 AI 工具：读取智能表格
    api.registerTool(
      (ctx) => {
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createReadWecomSheetTool();
      },
      { names: ["read_wecom_sheet"] }
    );

    // 注册 AI 工具：读取文档
    api.registerTool(
      (ctx) => {
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createReadWecomDocTool();
      },
      { names: ["read_wecom_doc"] }
    );

    // 注册 AI 工具：获取客户列表
    api.registerTool(
      (ctx) => {
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createGetCustomerListTool();
      },
      { names: ["get_wecom_customers"] }
    );

    // 注册 AI 工具：获取客户详情
    api.registerTool(
      (ctx) => {
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createGetCustomerDetailTool();
      },
      { names: ["get_wecom_customer_detail"] }
    );

    // 注册消息发送钩子，实现双向同步
    api.registerHook(
      "message_sent",
      async (event: any) => {
        const channel = event.channel || event.provider;
        if (channel === "wecom") {
          return; // 企业微信自己发的消息不需要再同步
        }

        const activeChat = getActiveWecomChat();
        if (!activeChat) {
          return;
        }

        const content = event.content || event.text;
        if (content && typeof content === "string") {
          try {
            await syncMessageToWecom(content);
            api.logger.info(`[wecom-sync] 已同步消息到企业微信: ${content.slice(0, 30)}...`);
          } catch (err) {
            api.logger.error(`[wecom-sync] 同步失败: ${String(err)}`);
          }
        }
      },
      { name: "wecom-message-sync" }
    );

    api.logger.info("企业微信插件已加载（HTTP 回调模式，支持智能表格和客户信息）");
  },
};

export default plugin;
