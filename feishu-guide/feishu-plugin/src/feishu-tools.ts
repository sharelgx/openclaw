/**
 * 飞书文档工具
 * 提供 AI 可调用的飞书文档保存功能
 */
import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import {
  createDocument,
  saveToDailyDocument,
  createSpreadsheet,
  listFolders,
} from "./doc-service.js";

// 配置引用
let configRef: OpenClawConfig | null = null;

export function setToolConfig(cfg: OpenClawConfig) {
  configRef = cfg;
}

export function getToolConfig(): OpenClawConfig | null {
  return configRef;
}

/**
 * 创建保存到飞书文档的工具
 */
export function createSaveToFeishuDocTool() {
  return {
    name: "save_to_feishu_doc",
    description: "将内容保存到飞书云文档。可以创建新文档或保存到每日文档。成功后返回文档链接。",
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "文档标题（创建新文档时使用）" })),
      content: Type.String({ description: "要保存的内容（支持 Markdown 格式）" }),
      mode: Type.Unsafe<"new" | "daily">({
        type: "string",
        enum: ["new", "daily"],
        description: "保存模式：new=创建新文档，daily=保存到每日文档",
      }),
      folderToken: Type.Optional(Type.String({ description: "文件夹Token（可选，指定保存位置）" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到，无法保存文档" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const content = String(params.content || "");
      const mode = String(params.mode || "new");
      const title = params.title ? String(params.title) : undefined;
      const folderToken = params.folderToken ? String(params.folderToken) : undefined;

      if (!content.trim()) {
        return {
          content: [{ type: "text", text: "❌ 内容不能为空" }],
          details: { success: false, error: "内容为空" },
        };
      }

      try {
        if (mode === "daily") {
          const result = await saveToDailyDocument(cfg, content, folderToken);
          if (result.success) {
            return {
              content: [{ type: "text", text: `✅ 已保存到每日文档！\n🔗 链接：${result.url}` }],
              details: { success: true, url: result.url, documentId: result.documentId },
            };
          }
          return {
            content: [{ type: "text", text: `❌ 保存失败：${result.error}` }],
            details: { success: false, error: result.error },
          };
        }

        // mode === "new"
        const docTitle = title || `OpenClaw 文档 - ${new Date().toLocaleString("zh-CN")}`;
        const result = await createDocument(cfg, docTitle, content, folderToken);
        if (result.success) {
          return {
            content: [{ type: "text", text: `✅ 文档已创建！\n📄 标题：${docTitle}\n🔗 链接：${result.url}` }],
            details: { success: true, url: result.url, documentId: result.documentId, title: docTitle },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 创建文档失败：${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败：${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 创建飞书表格工具
 */
export function createFeishuSheetTool() {
  return {
    name: "create_feishu_sheet",
    description: "创建飞书电子表格。成功后返回表格链接。",
    parameters: Type.Object({
      title: Type.String({ description: "表格标题" }),
      data: Type.Optional(
        Type.Array(Type.Array(Type.String()), {
          description: "表格数据，二维数组格式，第一行为表头",
        })
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const title = String(params.title || "未命名表格");
      const data = params.data as string[][] | undefined;

      try {
        const result = await createSpreadsheet(cfg, title, data);
        if (result.success) {
          return {
            content: [{ type: "text", text: `✅ 表格已创建！\n📊 标题：${title}\n🔗 链接：${result.url}` }],
            details: { success: true, url: result.url, spreadsheetToken: result.spreadsheetToken },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 创建表格失败：${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败：${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 创建列出云空间文件夹工具
 */
export function createListFoldersTool() {
  return {
    name: "list_feishu_folders",
    description: "列出飞书云空间的文件夹，用于选择保存位置。",
    parameters: Type.Object({
      folderToken: Type.Optional(
        Type.String({ description: "父文件夹Token（可选，为空则列出根目录）" })
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const folderToken = params.folderToken ? String(params.folderToken) : undefined;

      try {
        const result = await listFolders(cfg, folderToken);
        if (result.success) {
          const folderList =
            result.folders?.map((f) => `📁 ${f.name} (token: ${f.token})`).join("\n") || "（空）";
          return {
            content: [{ type: "text", text: `云空间文件夹列表：\n${folderList}` }],
            details: { success: true, folders: result.folders },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 获取文件夹列表失败：${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败：${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}
