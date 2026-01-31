/**
 * 企业微信 AI 工具
 */
import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import {
  readSmartSheet,
  readDocument,
  getDocBaseInfo,
  getExternalContactList,
  getExternalContactDetail,
  createSmartSheet,
  addSmartSheetField,
  addSmartSheetRecord,
  getAllCustomers,
  createWecomDocument,
  deleteWecomDocument,
  editWecomDocument,
  updateSmartSheetRecord,
  deleteSmartSheetRecord,
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
 * 读取企业微信智能表格工具
 */
export function createReadWecomSheetTool() {
  return {
    name: "read_wecom_sheet",
    label: "读取企业微信智能表格",
    description: "读取企业微信智能表格的数据。需要提供文档ID（从文档URL中获取）",
    parameters: Type.Object({
      docId: Type.String({ description: "文档ID（从文档链接中获取）" }),
      sheetId: Type.Optional(Type.String({ description: "Sheet ID（可选，默认读取第一个）" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const docId = String(params.docId || "");
      const sheetId = params.sheetId ? String(params.sheetId) : undefined;

      if (!docId.trim()) {
        return {
          content: [{ type: "text", text: "❌ 文档ID不能为空" }],
          details: { success: false, error: "文档ID为空" },
        };
      }

      try {
        const result = await readSmartSheet(cfg, docId, sheetId);
        if (result.success) {
          // 格式化输出
          const fields = result.fields || [];
          const records = result.records || [];

          let output = `📊 智能表格数据\n`;
          output += `字段数: ${fields.length}, 记录数: ${records.length}\n\n`;

          // 输出字段名
          if (fields.length > 0) {
            output += `字段: ${fields.map((f: any) => f.field_title || f.field_id).join(" | ")}\n`;
            output += "-".repeat(50) + "\n";
          }

          // 输出记录（最多 20 条）
          for (const record of records.slice(0, 20)) {
            const values = record.values || {};
            const row = fields.map((f: any) => {
              const val = values[f.field_id];
              if (Array.isArray(val)) {
                return val.map((v: any) => v.text || v.value || JSON.stringify(v)).join(", ");
              }
              return val?.text || val?.value || String(val || "");
            });
            output += row.join(" | ") + "\n";
          }

          if (records.length > 20) {
            output += `\n... 还有 ${records.length - 20} 条记录`;
          }

          return {
            content: [{ type: "text", text: output }],
            details: { success: true, fields, recordCount: records.length },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 读取失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 读取企业微信文档工具
 */
export function createReadWecomDocTool() {
  return {
    name: "read_wecom_doc",
    label: "读取企业微信文档",
    description: "读取企业微信文档的内容。需要提供文档ID",
    parameters: Type.Object({
      docId: Type.String({ description: "文档ID（从文档链接中获取）" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const docId = String(params.docId || "");

      if (!docId.trim()) {
        return {
          content: [{ type: "text", text: "❌ 文档ID不能为空" }],
          details: { success: false, error: "文档ID为空" },
        };
      }

      try {
        const result = await readDocument(cfg, docId);
        if (result.success) {
          const content = result.content || "（文档为空）";
          return {
            content: [{ type: "text", text: `📄 文档内容:\n\n${content}` }],
            details: { success: true, content: result.content },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 读取失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 获取客户列表工具（需要指定 userId，一般不用这个）
 */
export function createGetCustomerListTool() {
  return {
    name: "get_wecom_customers",
    label: "获取指定员工的客户",
    description: "获取指定员工的企业微信客户列表。注意：需要提供员工UserID。如果要获取所有客户，请使用 list_all_wecom_customers 工具。",
    parameters: Type.Object({
      userId: Type.String({ description: "员工的企业微信用户ID" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const userId = String(params.userId || "");

      if (!userId.trim()) {
        return {
          content: [{ type: "text", text: "❌ 用户ID不能为空" }],
          details: { success: false, error: "用户ID为空" },
        };
      }

      try {
        const result = await getExternalContactList(cfg, userId);
        if (result.success) {
          const contactIds = result.contactIds || [];
          if (contactIds.length === 0) {
            return {
              content: [{ type: "text", text: "该员工暂无客户" }],
              details: { success: true, contactIds: [] },
            };
          }
          return {
            content: [{ type: "text", text: `👥 客户数量: ${contactIds.length}\n\n客户ID列表:\n${contactIds.join("\n")}` }],
            details: { success: true, contactIds },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 获取失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 获取客户详情工具
 */
export function createGetCustomerDetailTool() {
  return {
    name: "get_wecom_customer_detail",
    label: "获取客户详情",
    description: "获取企业微信客户的详细信息",
    parameters: Type.Object({
      externalUserId: Type.String({ description: "外部联系人的用户ID" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const externalUserId = String(params.externalUserId || "");

      if (!externalUserId.trim()) {
        return {
          content: [{ type: "text", text: "❌ 客户ID不能为空" }],
          details: { success: false, error: "客户ID为空" },
        };
      }

      try {
        const result = await getExternalContactDetail(cfg, externalUserId);
        if (result.success) {
          const contact = result.contact;
          const external = contact?.externalContact || {};
          const followUsers = contact?.followUser || [];

          let output = `👤 客户信息\n`;
          output += `姓名: ${external.name || "未知"}\n`;
          output += `类型: ${external.type === 1 ? "微信用户" : "企业微信用户"}\n`;
          output += `性别: ${external.gender === 1 ? "男" : external.gender === 2 ? "女" : "未知"}\n`;
          
          if (external.corp_name) {
            output += `公司: ${external.corp_name}\n`;
          }
          if (external.position) {
            output += `职位: ${external.position}\n`;
          }

          if (followUsers.length > 0) {
            output += `\n添加此客户的员工:\n`;
            for (const fu of followUsers) {
              output += `- ${fu.userid} (添加时间: ${new Date(fu.createtime * 1000).toLocaleString("zh-CN")})\n`;
              if (fu.description) {
                output += `  备注: ${fu.description}\n`;
              }
              if (fu.tags && fu.tags.length > 0) {
                output += `  标签: ${fu.tags.map((t: any) => t.tag_name).join(", ")}\n`;
              }
            }
          }

          return {
            content: [{ type: "text", text: output }],
            details: { success: true, contact },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 获取失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 列出所有客户工具（自动获取，无需 userId）- 首选工具
 */
export function createListAllCustomersTool() {
  return {
    name: "list_all_wecom_customers",
    label: "列出所有客户",
    description: "【首选】列出所有企业微信客户/学员的完整信息，包括姓名、公司、性别等。自动获取，无需任何参数。当用户要求查看客户、学员、联系人列表时，优先使用此工具。",
    parameters: Type.Object({}),
    async execute(_id: string, _params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      try {
        const result = await getAllCustomers(cfg);
        if (result.success) {
          const customers = result.customers || [];
          if (customers.length === 0) {
            return {
              content: [{ type: "text", text: "暂无客户数据" }],
              details: { success: true, customers: [] },
            };
          }

          let output = `👥 客户列表（共 ${customers.length} 人）\n\n`;
          
          for (let i = 0; i < customers.length; i++) {
            const c = customers[i];
            const gender = c.gender === 1 ? "男" : c.gender === 2 ? "女" : "";
            const company = c.corp_name ? `（${c.corp_name}）` : "";
            output += `${i + 1}. ${c.name || "未知"}${gender ? ` ${gender}` : ""}${company}\n`;
          }

          return {
            content: [{ type: "text", text: output }],
            details: { success: true, customers },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 获取失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 创建企业微信智能表格工具
 */
export function createCreateWecomSheetTool() {
  return {
    name: "create_wecom_sheet",
    label: "创建企业微信智能表格",
    description: "创建一个新的企业微信智能表格。创建后可以读取和编辑这个表格。",
    parameters: Type.Object({
      title: Type.String({ description: "智能表格的标题" }),
      adminUserId: Type.Optional(Type.String({ description: "管理员用户ID（可选）" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const title = String(params.title || "");
      const adminUserId = params.adminUserId ? String(params.adminUserId) : undefined;

      if (!title.trim()) {
        return {
          content: [{ type: "text", text: "❌ 表格标题不能为空" }],
          details: { success: false, error: "标题为空" },
        };
      }

      try {
        const adminUserIds = adminUserId ? [adminUserId] : undefined;
        const result = await createSmartSheet(cfg, title, adminUserIds);
        
        if (result.success) {
          let output = `✅ 智能表格创建成功！\n\n`;
          output += `📊 标题: ${title}\n`;
          output += `📝 文档ID: ${result.docId}\n`;
          if (result.url) {
            output += `🔗 链接: ${result.url}\n`;
          }
          output += `\n现在可以使用 read_wecom_sheet 工具读取这个表格了！`;

          return {
            content: [{ type: "text", text: output }],
            details: { success: true, docId: result.docId, url: result.url },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 创建失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 创建企业微信智能文档工具
 */
export function createCreateWecomDocTool() {
  return {
    name: "create_wecom_doc",
    label: "创建企业微信智能文档",
    description: "创建一个新的企业微信智能文档。创建后可以读取和编辑这个文档。",
    parameters: Type.Object({
      title: Type.String({ description: "文档的标题" }),
      adminUserId: Type.Optional(Type.String({ description: "管理员用户ID（可选）" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const title = String(params.title || "");
      const adminUserId = params.adminUserId ? String(params.adminUserId) : undefined;

      if (!title.trim()) {
        return {
          content: [{ type: "text", text: "❌ 文档标题不能为空" }],
          details: { success: false, error: "标题为空" },
        };
      }

      try {
        const adminUserIds = adminUserId ? [adminUserId] : undefined;
        const result = await createWecomDocument(cfg, title, adminUserIds);
        
        if (result.success) {
          let output = `✅ 智能文档创建成功！\n\n`;
          output += `📄 标题: ${title}\n`;
          output += `📝 文档ID: ${result.docId}\n`;
          if (result.url) {
            output += `🔗 链接: ${result.url}\n`;
          }
          output += `\n现在可以使用 edit_wecom_doc 工具编辑这个文档了！`;

          return {
            content: [{ type: "text", text: output }],
            details: { success: true, docId: result.docId, url: result.url },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 创建失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 编辑企业微信智能文档工具
 */
export function createEditWecomDocTool() {
  return {
    name: "edit_wecom_doc",
    label: "编辑企业微信智能文档",
    description: "编辑企业微信智能文档的内容。可以追加内容到末尾，或替换整个文档内容。",
    parameters: Type.Object({
      docId: Type.String({ description: "文档ID（从文档链接中获取）" }),
      content: Type.String({ description: "要写入的内容" }),
      mode: Type.Optional(Type.Unsafe<"append" | "replace">({ 
        description: "编辑模式：append=追加到末尾（默认），replace=替换全部内容",
        default: "append"
      })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const docId = String(params.docId || "");
      const content = String(params.content || "");
      const mode = (params.mode as "append" | "replace") || "append";

      if (!docId.trim()) {
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
        const result = await editWecomDocument(cfg, docId, content, mode);
        
        if (result.success) {
          const modeText = mode === "replace" ? "替换" : "追加";
          return {
            content: [{ type: "text", text: `✅ 文档${modeText}成功！\n\n内容已${modeText}到文档中。` }],
            details: { success: true, mode },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 编辑失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 删除企业微信文档/表格工具
 */
export function createDeleteWecomDocTool() {
  return {
    name: "delete_wecom_doc",
    label: "删除企业微信文档或表格",
    description: "删除企业微信的智能文档或智能表格。注意：只能删除应用自己创建的文档。",
    parameters: Type.Object({
      docId: Type.String({ description: "文档ID（从文档链接中获取）" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const docId = String(params.docId || "");

      if (!docId.trim()) {
        return {
          content: [{ type: "text", text: "❌ 文档ID不能为空" }],
          details: { success: false, error: "文档ID为空" },
        };
      }

      try {
        const result = await deleteWecomDocument(cfg, docId);
        
        if (result.success) {
          return {
            content: [{ type: "text", text: `✅ 文档删除成功！\n\n文档ID: ${docId}` }],
            details: { success: true, docId },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 删除失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 添加智能表格记录工具
 */
export function createAddSheetRecordTool() {
  return {
    name: "add_wecom_sheet_record",
    label: "添加智能表格记录",
    description: "向企业微信智能表格添加一条新记录。需要先使用 read_wecom_sheet 获取字段信息。",
    parameters: Type.Object({
      docId: Type.String({ description: "文档ID（从文档链接中获取）" }),
      sheetId: Type.Optional(Type.String({ description: "Sheet ID（可选，默认使用第一个）" })),
      values: Type.String({ description: "记录内容，JSON格式，键为字段ID，值为字段值" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const docId = String(params.docId || "");
      const sheetId = params.sheetId ? String(params.sheetId) : undefined;
      const valuesStr = String(params.values || "{}");

      if (!docId.trim()) {
        return {
          content: [{ type: "text", text: "❌ 文档ID不能为空" }],
          details: { success: false, error: "文档ID为空" },
        };
      }

      let values: Record<string, any>;
      try {
        values = JSON.parse(valuesStr);
      } catch {
        return {
          content: [{ type: "text", text: "❌ values 必须是有效的 JSON 格式" }],
          details: { success: false, error: "JSON格式错误" },
        };
      }

      try {
        // 如果没有指定 sheetId，先获取第一个 sheet
        let targetSheetId = sheetId;
        if (!targetSheetId) {
          const sheetResult = await readSmartSheet(cfg, docId);
          if (!sheetResult.success) {
            return {
              content: [{ type: "text", text: `❌ 获取表格信息失败: ${sheetResult.error}` }],
              details: { success: false, error: sheetResult.error },
            };
          }
          // 这里需要从返回的数据中获取 sheet_id，但当前实现没有返回
          // 暂时使用一个默认逻辑
        }

        const result = await addSmartSheetRecord(cfg, docId, targetSheetId || "", values);
        
        if (result.success) {
          return {
            content: [{ type: "text", text: `✅ 记录添加成功！\n\n记录ID: ${result.recordId || "已创建"}` }],
            details: { success: true, recordId: result.recordId },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 添加失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 更新智能表格记录工具
 */
export function createUpdateSheetRecordTool() {
  return {
    name: "update_wecom_sheet_record",
    label: "更新智能表格记录",
    description: "更新企业微信智能表格中的一条记录。需要提供记录ID和新的值。",
    parameters: Type.Object({
      docId: Type.String({ description: "文档ID（从文档链接中获取）" }),
      sheetId: Type.String({ description: "Sheet ID" }),
      recordId: Type.String({ description: "要更新的记录ID" }),
      values: Type.String({ description: "新的记录内容，JSON格式，键为字段ID，值为新的字段值" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const docId = String(params.docId || "");
      const sheetId = String(params.sheetId || "");
      const recordId = String(params.recordId || "");
      const valuesStr = String(params.values || "{}");

      if (!docId.trim() || !sheetId.trim() || !recordId.trim()) {
        return {
          content: [{ type: "text", text: "❌ 文档ID、Sheet ID 和 记录ID 都不能为空" }],
          details: { success: false, error: "参数缺失" },
        };
      }

      let values: Record<string, any>;
      try {
        values = JSON.parse(valuesStr);
      } catch {
        return {
          content: [{ type: "text", text: "❌ values 必须是有效的 JSON 格式" }],
          details: { success: false, error: "JSON格式错误" },
        };
      }

      try {
        const result = await updateSmartSheetRecord(cfg, docId, sheetId, recordId, values);
        
        if (result.success) {
          return {
            content: [{ type: "text", text: `✅ 记录更新成功！\n\n记录ID: ${recordId}` }],
            details: { success: true, recordId },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 更新失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}

/**
 * 删除智能表格记录工具
 */
export function createDeleteSheetRecordTool() {
  return {
    name: "delete_wecom_sheet_record",
    label: "删除智能表格记录",
    description: "删除企业微信智能表格中的一条或多条记录。",
    parameters: Type.Object({
      docId: Type.String({ description: "文档ID（从文档链接中获取）" }),
      sheetId: Type.String({ description: "Sheet ID" }),
      recordIds: Type.String({ description: "要删除的记录ID，多个用逗号分隔" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = configRef;
      if (!cfg) {
        return {
          content: [{ type: "text", text: "❌ 配置未找到" }],
          details: { success: false, error: "配置未找到" },
        };
      }

      const docId = String(params.docId || "");
      const sheetId = String(params.sheetId || "");
      const recordIdsStr = String(params.recordIds || "");

      if (!docId.trim() || !sheetId.trim() || !recordIdsStr.trim()) {
        return {
          content: [{ type: "text", text: "❌ 文档ID、Sheet ID 和 记录ID 都不能为空" }],
          details: { success: false, error: "参数缺失" },
        };
      }

      const recordIds = recordIdsStr.split(",").map(id => id.trim()).filter(id => id);

      if (recordIds.length === 0) {
        return {
          content: [{ type: "text", text: "❌ 至少需要提供一个记录ID" }],
          details: { success: false, error: "记录ID为空" },
        };
      }

      try {
        const result = await deleteSmartSheetRecord(cfg, docId, sheetId, recordIds);
        
        if (result.success) {
          return {
            content: [{ type: "text", text: `✅ 记录删除成功！\n\n已删除 ${recordIds.length} 条记录` }],
            details: { success: true, deletedCount: recordIds.length },
          };
        }
        return {
          content: [{ type: "text", text: `❌ 删除失败: ${result.error}` }],
          details: { success: false, error: result.error },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ 操作失败: ${error}` }],
          details: { success: false, error },
        };
      }
    },
  };
}
