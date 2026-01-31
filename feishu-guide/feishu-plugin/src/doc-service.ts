/**
 * 飞书云文档服务
 * 支持创建文档、保存内容、追加到每日文档
 */
import * as Lark from "@larksuiteoapi/node-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";

// 缓存客户端
let cachedClient: Lark.Client | null = null;

function getClient(cfg: OpenClawConfig): Lark.Client {
  if (cachedClient) return cachedClient;
  
  const feishuConfig = cfg.channels?.feishu as any;
  const appId = feishuConfig?.appId;
  const appSecret = feishuConfig?.appSecret;
  
  if (!appId || !appSecret) {
    throw new Error("飞书 appId/appSecret 未配置");
  }
  
  cachedClient = new Lark.Client({
    appId,
    appSecret,
    appType: Lark.AppType.SelfBuild,
    domain: Lark.Domain.Feishu,
  });
  
  return cachedClient;
}

/**
 * 将 Markdown 转换为飞书文档 Block 格式
 * 参考：https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/document-docx/docx-v1/document-block-children/create
 */
function markdownToBlocks(markdown: string): any[] {
  const blocks: any[] = [];
  const lines = markdown.split("\n");
  let currentParagraph: string[] = [];
  
  // 创建文本元素
  const createTextElement = (content: string) => ({
    text_run: { content }
  });
  
  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join("\n");
      blocks.push({
        block_type: 2, // text
        text: {
          elements: [createTextElement(text)],
        },
      });
      currentParagraph = [];
    }
  };
  
  for (const line of lines) {
    // 标题
    if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push({
        block_type: 3, // heading1
        heading1: {
          elements: [createTextElement(line.slice(2))],
        },
      });
    } else if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({
        block_type: 4, // heading2
        heading2: {
          elements: [createTextElement(line.slice(3))],
        },
      });
    } else if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push({
        block_type: 5, // heading3
        heading3: {
          elements: [createTextElement(line.slice(4))],
        },
      });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      blocks.push({
        block_type: 14, // bullet
        bullet: {
          elements: [createTextElement(line.slice(2))],
        },
      });
    } else if (/^\d+\. /.test(line)) {
      flushParagraph();
      blocks.push({
        block_type: 15, // ordered
        ordered: {
          elements: [createTextElement(line.replace(/^\d+\. /, ""))],
        },
      });
    } else if (line.startsWith("```")) {
      flushParagraph();
      // 代码块开始/结束，简单处理
    } else if (line.trim() === "") {
      flushParagraph();
    } else {
      currentParagraph.push(line);
    }
  }
  
  flushParagraph();
  return blocks;
}

export interface CreateDocResult {
  success: boolean;
  documentId?: string;
  url?: string;
  error?: string;
}

/**
 * 创建新文档
 */
export async function createDocument(
  cfg: OpenClawConfig,
  title: string,
  content: string,
  folderToken?: string
): Promise<CreateDocResult> {
  try {
    const client = getClient(cfg);
    
    // 1. 创建文档
    const createRes = await client.docx.document.create({
      data: {
        title,
        folder_token: folderToken || "",
      },
    });
    
    if (createRes.code !== 0) {
      return {
        success: false,
        error: `创建文档失败: ${createRes.code} - ${createRes.msg}`,
      };
    }
    
    const documentId = createRes.data?.document?.document_id;
    if (!documentId) {
      return { success: false, error: "未获取到文档 ID" };
    }
    
    // 2. 获取文档的 block_id (根节点)
    const docRes = await client.docx.document.get({
      path: { document_id: documentId },
    });
    
    const blockId = docRes.data?.document?.document_id;
    
    // 3. 授予用户编辑权限
    // 获取当前活跃用户的 open_id
    const { getActiveFeishuChat } = await import("./sync-service.js");
    const activeChat = getActiveFeishuChat();
    if (activeChat?.userId) {
      try {
        // 添加用户为文档协作者（编辑权限）
        // 注意：API 是 permissionMember（驼峰命名），不是 permission.member
        const permRes = await client.drive.permissionMember.create({
          path: { token: documentId },
          params: { type: "docx", need_notification: false },
          data: {
            member_type: "openid",
            member_id: activeChat.userId,
            perm: "full_access", // 完全访问权限（可编辑、删除）
          },
        });
        if (permRes.code === 0) {
          console.log(`[feishu-doc] 已授予用户 ${activeChat.userId} 编辑权限`);
        } else {
          console.warn(`[feishu-doc] 授权失败: ${permRes.code} ${permRes.msg}`);
        }
      } catch (permErr) {
        console.warn(`[feishu-doc] 授权异常: ${permErr}`);
      }
    }
    
    // 4. 记录日志
    console.log(`[feishu-doc] 文档已创建，内容: ${content.slice(0, 50)}...`);
    
    const url = `https://feishu.cn/docx/${documentId}`;
    console.log(`[feishu-doc] 文档创建成功: ${url}`);
    
    return {
      success: true,
      documentId,
      url,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[feishu-doc] 创建文档失败: ${error}`);
    return { success: false, error };
  }
}

/**
 * 追加内容到已有文档
 */
export async function appendToDocument(
  cfg: OpenClawConfig,
  documentId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient(cfg);
    
    // 添加分隔线和时间戳
    const timestamp = new Date().toLocaleString("zh-CN");
    const fullContent = `\n---\n📅 ${timestamp}\n\n${content}`;
    
    const blocks = markdownToBlocks(fullContent);
    
    // 使用正确的 API: documentBlockChildren.create
    // 一次性追加所有块到文档末尾
    await client.docx.documentBlockChildren.create({
      path: { document_id: documentId, block_id: documentId },
      params: { document_revision_id: -1 },
      data: {
        children: blocks,
        index: -1, // 追加到末尾
      },
    });
    
    console.log(`[feishu-doc] 内容已追加到文档: ${documentId}`);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[feishu-doc] 追加内容失败: ${error}`);
    return { success: false, error };
  }
}

// 每日文档缓存 (日期 -> 文档ID)
const dailyDocCache = new Map<string, string>();

/**
 * 保存到每日文档
 * 如果当天文档不存在则创建，存在则追加
 */
export async function saveToDailyDocument(
  cfg: OpenClawConfig,
  content: string,
  folderToken?: string
): Promise<CreateDocResult> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const title = `📝 每日记录 - ${today}`;
  
  // 检查缓存
  const cachedDocId = dailyDocCache.get(today);
  if (cachedDocId) {
    const appendResult = await appendToDocument(cfg, cachedDocId, content);
    if (appendResult.success) {
      return {
        success: true,
        documentId: cachedDocId,
        url: `https://feishu.cn/docx/${cachedDocId}`,
      };
    }
    // 如果追加失败，可能文档被删除了，清除缓存重新创建
    dailyDocCache.delete(today);
  }
  
  // 创建新的每日文档
  const result = await createDocument(cfg, title, content, folderToken);
  if (result.success && result.documentId) {
    dailyDocCache.set(today, result.documentId);
  }
  
  return result;
}

/**
 * 创建电子表格
 */
export async function createSpreadsheet(
  cfg: OpenClawConfig,
  title: string,
  data?: string[][]
): Promise<{ success: boolean; spreadsheetToken?: string; url?: string; error?: string }> {
  try {
    const client = getClient(cfg);
    
    const createRes = await client.sheets.spreadsheet.create({
      data: { title },
    });
    
    if (createRes.code !== 0) {
      return {
        success: false,
        error: `创建表格失败: ${createRes.code} - ${createRes.msg}`,
      };
    }
    
    const spreadsheetToken = createRes.data?.spreadsheet?.spreadsheet_token;
    if (!spreadsheetToken) {
      return { success: false, error: "未获取到表格 Token" };
    }
    
    // 如果有数据，写入表格
    if (data && data.length > 0) {
      const sheetId = createRes.data?.spreadsheet?.sheet_list?.[0]?.sheet_id;
      if (sheetId) {
        await client.sheets.spreadsheetSheetValues.batchUpdate({
          path: { spreadsheet_token: spreadsheetToken },
          data: {
            value_ranges: [
              {
                range: `${sheetId}!A1`,
                values: data,
              },
            ],
          },
        });
      }
    }
    
    // 授予用户编辑权限
    const { getActiveFeishuChat } = await import("./sync-service.js");
    const activeChat = getActiveFeishuChat();
    if (activeChat?.userId) {
      try {
        // 注意：API 是 permissionMember（驼峰命名），不是 permission.member
        const permRes = await client.drive.permissionMember.create({
          path: { token: spreadsheetToken },
          params: { type: "sheet", need_notification: false },
          data: {
            member_type: "openid",
            member_id: activeChat.userId,
            perm: "full_access",
          },
        });
        if (permRes.code === 0) {
          console.log(`[feishu-doc] 已授予用户 ${activeChat.userId} 表格编辑权限`);
        } else {
          console.warn(`[feishu-doc] 表格授权失败: ${permRes.code} ${permRes.msg}`);
        }
      } catch (permErr) {
        console.warn(`[feishu-doc] 表格授权异常: ${permErr}`);
      }
    }
    
    const url = `https://feishu.cn/sheets/${spreadsheetToken}`;
    console.log(`[feishu-doc] 表格创建成功: ${url}`);
    
    return {
      success: true,
      spreadsheetToken,
      url,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[feishu-doc] 创建表格失败: ${error}`);
    return { success: false, error };
  }
}

/**
 * 编辑文档内容（替换整个文档内容）
 */
export async function editDocument(
  cfg: OpenClawConfig,
  documentId: string,
  newContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient(cfg);
    
    // 1. 获取文档的所有 blocks
    const blocksRes = await client.docx.documentBlock.list({
      path: { document_id: documentId },
      params: { page_size: 500, document_revision_id: -1 },
    });
    
    if (blocksRes.code !== 0) {
      return { success: false, error: `获取文档结构失败: ${blocksRes.msg}` };
    }
    
    const blocks = blocksRes.data?.items || [];
    // 过滤出文本类型的 blocks (type 2-15 是各种文本/列表类型)
    const contentBlocks = blocks.filter(b => b.block_type >= 2 && b.block_type <= 15);
    
    // 2. 删除所有内容 blocks
    if (contentBlocks.length > 0) {
      // 使用 batch_delete 删除所有子块
      try {
        await client.docx.documentBlockChildren.batchDelete({
          path: { document_id: documentId, block_id: documentId },
          params: { document_revision_id: -1 },
          data: {
            start_index: 0,
            end_index: contentBlocks.length,
          },
        });
      } catch (err) {
        // 如果批量删除失败，继续尝试添加新内容
        console.warn(`[feishu-doc] 删除旧内容失败，尝试直接覆盖: ${err}`);
      }
    }
    
    // 3. 添加新内容
    const newBlocks = markdownToBlocks(newContent);
    if (newBlocks.length > 0) {
      const addRes = await client.docx.documentBlockChildren.create({
        path: { document_id: documentId, block_id: documentId },
        params: { document_revision_id: -1 },
        data: {
          children: newBlocks,
          index: 0,
        },
      });
      
      if (addRes.code !== 0) {
        return { success: false, error: `添加新内容失败: ${addRes.msg}` };
      }
    }
    
    console.log(`[feishu-doc] 文档内容已更新: ${documentId}`);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[feishu-doc] 编辑文档失败: ${error}`);
    return { success: false, error };
  }
}

/**
 * 读取文档内容
 */
export async function readDocument(
  cfg: OpenClawConfig,
  documentId: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const client = getClient(cfg);
    
    const res = await client.docx.document.rawContent({
      path: { document_id: documentId },
    });
    
    if (res.code !== 0) {
      return {
        success: false,
        error: `读取文档失败: ${res.code} - ${res.msg}`,
      };
    }
    
    return {
      success: true,
      content: res.data?.content || "",
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[feishu-doc] 读取文档失败: ${error}`);
    return { success: false, error };
  }
}

/**
 * 删除文档或表格
 */
export async function deleteFile(
  cfg: OpenClawConfig,
  fileToken: string,
  fileType: "docx" | "sheet" | "file" | "folder" = "docx"
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient(cfg);
    
    const res = await client.drive.file.delete({
      path: { file_token: fileToken },
      params: { type: fileType },
    });
    
    if (res.code !== 0) {
      return {
        success: false,
        error: `删除文件失败: ${res.code} - ${res.msg}`,
      };
    }
    
    console.log(`[feishu-doc] 文件已删除: ${fileToken} (task_id: ${res.data?.task_id})`);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[feishu-doc] 删除文件失败: ${error}`);
    return { success: false, error };
  }
}

/**
 * 列出云空间文件夹
 */
export async function listFolders(
  cfg: OpenClawConfig,
  folderToken?: string
): Promise<{ success: boolean; folders?: Array<{ token: string; name: string }>; error?: string }> {
  try {
    const client = getClient(cfg);
    
    const res = await client.drive.file.list({
      params: {
        folder_token: folderToken || "",
        page_size: 50,
      },
    });
    
    if (res.code !== 0) {
      return {
        success: false,
        error: `获取文件夹列表失败: ${res.code} - ${res.msg}`,
      };
    }
    
    const folders = (res.data?.files || [])
      .filter((f: any) => f.type === "folder")
      .map((f: any) => ({
        token: f.token,
        name: f.name,
      }));
    
    return { success: true, folders };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
