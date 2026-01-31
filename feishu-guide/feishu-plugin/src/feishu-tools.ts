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
  readDocument,
  deleteFile,
  appendToDocument,
  editDocument,
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

/**
 * 创建读取飞书文档工具
 */
export function createReadFeishuDocTool() {
  return {
    name: "read_feishu_doc",
    description: "读取飞书云文档的内容。需要提供文档ID（从文档URL中获取，如 https://feishu.cn/docx/ABC123 中的 ABC123）",
    parameters: Type.Object({
      documentId: Type.String({ description: "文档ID（从文档链接中获取）" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const documentId = String(params.documentId || "").trim();
      console.log(`[feishu-tools] read_feishu_doc 参数: documentId="${documentId}" (长度: ${documentId.length})`);
      
      if (!documentId) {
        return {
          content: [{ type: "text", text: "❌ 文档ID不能为空" }],
          details: { success: false, error: "文档ID为空" },
        };
      }

      try {
        const result = await readDocument(cfg, documentId);
        if (result.success) {
          const content = result.content || "（文档为空）";
          return {
            content: [{ type: "text", text: `📄 文档内容：\n\n${content}` }],
            details: { success: true, content: result.content, documentId },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 读取文档失败：${result.error}` }],
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
 * 创建追加内容到飞书文档工具
 */
export function createAppendToFeishuDocTool() {
  return {
    name: "append_to_feishu_doc",
    description: "向现有飞书文档追加内容。内容会添加到文档末尾，自动带有时间戳分隔。",
    parameters: Type.Object({
      documentId: Type.String({ description: "文档ID（从文档链接中获取）" }),
      content: Type.String({ description: "要追加的内容（支持 Markdown 格式）" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const documentId = String(params.documentId || "").trim();
      const content = String(params.content || "");
      console.log(`[feishu-tools] append_to_feishu_doc 参数: documentId="${documentId}" (长度: ${documentId.length})`);

      if (!documentId) {
        return {
          content: [{ type: "text", text: "❌ 文档ID不能为空" }],
          details: { success: false, error: "文档ID为空" },
        };
      }

      if (!content.trim()) {
        return {
          content: [{ type: "text", text: "❌ 内容不能为空" }],
          details: { success: false, error: "内容为空" },
        };
      }

      try {
        const result = await appendToDocument(cfg, documentId, content);
        if (result.success) {
          const url = `https://feishu.cn/docx/${documentId}`;
          return {
            content: [{ type: "text", text: `✅ 内容已追加到文档！\n🔗 链接：${url}` }],
            details: { success: true, documentId, url },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 追加内容失败：${result.error}` }],
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
 * 创建删除飞书文档工具
 */
export function createDeleteFeishuFileTool() {
  return {
    name: "delete_feishu_file",
    description: "删除飞书云文档或表格。删除后文件会移到回收站。",
    parameters: Type.Object({
      fileToken: Type.String({ description: "文件Token/ID（从文件链接中获取）" }),
      fileType: Type.Unsafe<"docx" | "sheet" | "file" | "folder">({
        type: "string",
        enum: ["docx", "sheet", "file", "folder"],
        description: "文件类型：docx=文档，sheet=表格，file=普通文件，folder=文件夹",
      }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const fileToken = String(params.fileToken || "");
      const fileType = (params.fileType || "docx") as "docx" | "sheet" | "file" | "folder";

      if (!fileToken.trim()) {
        return {
          content: [{ type: "text", text: "❌ 文件Token不能为空" }],
          details: { success: false, error: "文件Token为空" },
        };
      }

      try {
        const result = await deleteFile(cfg, fileToken, fileType);
        if (result.success) {
          return {
            content: [{ type: "text", text: `✅ 文件已删除（已移至回收站）` }],
            details: { success: true, fileToken, fileType },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 删除文件失败：${result.error}` }],
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
 * 创建编辑飞书文档工具
 */
export function createEditFeishuDocTool() {
  return {
    name: "edit_feishu_doc",
    description: "编辑（替换）飞书文档的内容。会用新内容替换整个文档内容。",
    parameters: Type.Object({
      documentId: Type.String({ description: "文档ID（从文档链接中获取）" }),
      newContent: Type.String({ description: "新的文档内容（支持 Markdown 格式）" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const documentId = String(params.documentId || "").trim();
      const newContent = String(params.newContent || "");
      console.log(`[feishu-tools] edit_feishu_doc 参数: documentId="${documentId}" (长度: ${documentId.length})`);

      if (!documentId) {
        return {
          content: [{ type: "text", text: "❌ 文档ID不能为空" }],
          details: { success: false, error: "文档ID为空" },
        };
      }

      if (!newContent.trim()) {
        return {
          content: [{ type: "text", text: "❌ 新内容不能为空" }],
          details: { success: false, error: "新内容为空" },
        };
      }

      try {
        const result = await editDocument(cfg, documentId, newContent);
        if (result.success) {
          const url = `https://feishu.cn/docx/${documentId}`;
          return {
            content: [{ type: "text", text: `✅ 文档内容已更新！\n🔗 链接：${url}` }],
            details: { success: true, documentId, url },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 编辑文档失败：${result.error}` }],
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
