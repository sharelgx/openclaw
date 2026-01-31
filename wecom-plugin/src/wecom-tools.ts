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
 * 获取客户列表工具
 */
export function createGetCustomerListTool() {
  return {
    name: "get_wecom_customers",
    description: "获取企业微信的客户列表。需要提供员工的企业微信用户ID",
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
