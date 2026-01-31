import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { feishuPlugin } from "./src/channel.js";
import { setFeishuRuntime } from "./src/runtime.js";
import { getActiveFeishuChat, syncMessageToFeishu, getFeishuConfig } from "./src/sync-service.js";
import {
  createSaveToFeishuDocTool,
  createFeishuSheetTool,
  createListFoldersTool,
  createReadFeishuDocTool,
  createAppendToFeishuDocTool,
  createDeleteFeishuFileTool,
  setToolConfig,
} from "./src/feishu-tools.js";

// 全局错误处理 - 防止未捕获的异常导致进程崩溃
process.on("uncaughtException", (err) => {
  // 忽略 mdns 服务器关闭相关的错误
  if (err.message?.includes("closed mdns server") || 
      err.message?.includes("ERR_SERVER_CLOSED")) {
    console.log("[feishu-plugin] 忽略 mdns 服务器关闭错误（正常现象）");
    return;
  }
  // 其他未捕获的异常记录但不崩溃
  console.error("[feishu-plugin] 未捕获的异常:", err.message);
});

process.on("unhandledRejection", (reason) => {
  // 忽略特定的 Promise 拒绝
  const msg = String(reason);
  if (msg.includes("closed mdns server") || 
      msg.includes("ERR_SERVER_CLOSED") ||
      msg.includes("stop is not a function")) {
    console.log("[feishu-plugin] 忽略预期内的 Promise 拒绝");
    return;
  }
  console.error("[feishu-plugin] 未处理的 Promise 拒绝:", msg);
});

const plugin = {
  id: "feishu",
  name: "飞书",
  description: "飞书频道插件 (Feishu/Lark)，使用长连接接收事件，支持云文档保存",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setFeishuRuntime(api.runtime);
    api.registerChannel({ plugin: feishuPlugin });

    // 注册 AI 工具：保存到飞书文档
    api.registerTool(
      (ctx) => {
        // 设置配置引用，供工具使用
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createSaveToFeishuDocTool();
      },
      { names: ["save_to_feishu_doc"] }
    );

    // 注册 AI 工具：创建飞书表格
    api.registerTool(
      (ctx) => {
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createFeishuSheetTool();
      },
      { names: ["create_feishu_sheet"] }
    );

    // 注册 AI 工具：列出云空间文件夹
    api.registerTool(
      (ctx) => {
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createListFoldersTool();
      },
      { names: ["list_feishu_folders"] }
    );

    // 注册 AI 工具：读取飞书文档
    api.registerTool(
      (ctx) => {
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createReadFeishuDocTool();
      },
      { names: ["read_feishu_doc"] }
    );

    // 注册 AI 工具：追加内容到飞书文档
    api.registerTool(
      (ctx) => {
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createAppendToFeishuDocTool();
      },
      { names: ["append_to_feishu_doc"] }
    );

    // 注册 AI 工具：删除飞书文件
    api.registerTool(
      (ctx) => {
        if (ctx.config) {
          setToolConfig(ctx.config);
        }
        return createDeleteFeishuFileTool();
      },
      { names: ["delete_feishu_file"] }
    );

    // 注册消息发送钩子，实现双向同步
    api.registerHook(
      "message_sent",
      async (event: any) => {
        // 只同步非飞书来源的消息到飞书
        const channel = event.channel || event.provider;
        if (channel === "feishu") {
          return; // 飞书自己发的消息不需要再同步回去
        }

        const activeChat = getActiveFeishuChat();
        if (!activeChat) {
          return; // 没有活跃的飞书聊天
        }

        // 同步 AI 回复到飞书
        const content = event.content || event.text;
        if (content && typeof content === "string") {
          try {
            await syncMessageToFeishu(content);
            api.logger.info(`[feishu-sync] 已同步消息到飞书: ${content.slice(0, 30)}...`);
          } catch (err) {
            api.logger.error(`[feishu-sync] 同步失败: ${String(err)}`);
          }
        }
      },
      { name: "feishu-message-sync" }
    );

    api.logger.info("飞书插件已加载（长连接模式，支持云文档保存）");
  },
};

export default plugin;
