import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { feishuPlugin } from "./src/channel.js";
import { setFeishuRuntime } from "./src/runtime.js";
import { getActiveFeishuChat, syncMessageToFeishu, getFeishuConfig } from "./src/sync-service.js";
import {
  createDocument,
  appendToDocument,
  saveToDailyDocument,
  createSpreadsheet,
  listFolders,
} from "./src/doc-service.js";

// 存储配置的引用
let pluginApi: OpenClawPluginApi | null = null;

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
    pluginApi = api;
    setFeishuRuntime(api.runtime);
    api.registerChannel({ plugin: feishuPlugin });

    // 注册 AI 工具：保存到飞书文档
    api.registerTool?.({
      name: "save_to_feishu_doc",
      description: "将内容保存到飞书云文档。可以创建新文档或追加到每日文档。",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "文档标题（创建新文档时使用）",
          },
          content: {
            type: "string",
            description: "要保存的内容（支持 Markdown 格式）",
          },
          mode: {
            type: "string",
            enum: ["new", "daily", "append"],
            description: "保存模式：new=创建新文档，daily=保存到每日文档，append=追加到指定文档",
          },
          documentId: {
            type: "string",
            description: "文档ID（mode=append 时需要）",
          },
          folderToken: {
            type: "string",
            description: "文件夹Token（可选，指定保存位置）",
          },
        },
        required: ["content", "mode"],
      },
      execute: async (params: any, context: any) => {
        const cfg = context.cfg || getFeishuConfig();
        if (!cfg) {
          return { success: false, error: "配置未找到" };
        }

        const { title, content, mode, documentId, folderToken } = params;

        try {
          if (mode === "new") {
            const docTitle = title || `OpenClaw 文档 - ${new Date().toLocaleString("zh-CN")}`;
            const result = await createDocument(cfg, docTitle, content, folderToken);
            if (result.success) {
              return {
                success: true,
                message: `✅ 文档已创建！\n📄 标题：${docTitle}\n🔗 链接：${result.url}`,
                url: result.url,
              };
            }
            return { success: false, error: result.error };
          }

          if (mode === "daily") {
            const result = await saveToDailyDocument(cfg, content, folderToken);
            if (result.success) {
              return {
                success: true,
                message: `✅ 已保存到每日文档！\n🔗 链接：${result.url}`,
                url: result.url,
              };
            }
            return { success: false, error: result.error };
          }

          if (mode === "append") {
            if (!documentId) {
              return { success: false, error: "追加模式需要提供 documentId" };
            }
            const result = await appendToDocument(cfg, documentId, content);
            if (result.success) {
              return {
                success: true,
                message: `✅ 内容已追加到文档！\n🔗 链接：https://feishu.cn/docx/${documentId}`,
              };
            }
            return { success: false, error: result.error };
          }

          return { success: false, error: "未知的保存模式" };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    });

    // 注册 AI 工具：创建飞书表格
    api.registerTool?.({
      name: "create_feishu_sheet",
      description: "创建飞书电子表格并写入数据",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "表格标题",
          },
          data: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" },
            },
            description: "表格数据，二维数组格式，第一行为表头",
          },
        },
        required: ["title"],
      },
      execute: async (params: any, context: any) => {
        const cfg = context.cfg || getFeishuConfig();
        if (!cfg) {
          return { success: false, error: "配置未找到" };
        }

        const { title, data } = params;
        const result = await createSpreadsheet(cfg, title, data);

        if (result.success) {
          return {
            success: true,
            message: `✅ 表格已创建！\n📊 标题：${title}\n🔗 链接：${result.url}`,
            url: result.url,
          };
        }
        return { success: false, error: result.error };
      },
    });

    // 注册 AI 工具：列出云空间文件夹
    api.registerTool?.({
      name: "list_feishu_folders",
      description: "列出飞书云空间的文件夹，用于选择保存位置",
      parameters: {
        type: "object",
        properties: {
          folderToken: {
            type: "string",
            description: "父文件夹Token（可选，为空则列出根目录）",
          },
        },
      },
      execute: async (params: any, context: any) => {
        const cfg = context.cfg || getFeishuConfig();
        if (!cfg) {
          return { success: false, error: "配置未找到" };
        }

        const result = await listFolders(cfg, params.folderToken);
        if (result.success) {
          const folderList = result.folders?.map(f => `📁 ${f.name} (token: ${f.token})`).join("\n") || "（空）";
          return {
            success: true,
            message: `云空间文件夹列表：\n${folderList}`,
            folders: result.folders,
          };
        }
        return { success: false, error: result.error };
      },
    });

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
