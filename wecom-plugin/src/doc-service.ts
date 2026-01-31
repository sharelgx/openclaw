/**
 * 企业微信文档服务
 * 支持读取智能表格、智能文档
 */
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { getAccessToken } from "./send.js";

/**
 * 获取文档基本信息
 */
export async function getDocBaseInfo(
  cfg: OpenClawConfig,
  docId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/get_doc_base_info?access_token=${accessToken}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docid: docId }),
    });

    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    return { success: true, data: data.doc_base_info };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 读取智能表格数据
 */
export async function readSmartSheet(
  cfg: OpenClawConfig,
  docId: string,
  sheetId?: string
): Promise<{ success: boolean; records?: any[]; fields?: any[]; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    
    // 1. 获取表格的 sheet 列表
    const sheetsUrl = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/get_sheet?access_token=${accessToken}`;
    const sheetsRes = await fetch(sheetsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docid: docId }),
    });
    const sheetsData = await sheetsRes.json() as any;

    if (sheetsData.errcode && sheetsData.errcode !== 0) {
      return { success: false, error: `获取 sheet 列表失败: ${sheetsData.errcode} - ${sheetsData.errmsg}` };
    }

    const sheets = sheetsData.sheet_list || [];
    const targetSheet = sheetId 
      ? sheets.find((s: any) => s.sheet_id === sheetId)
      : sheets[0];

    if (!targetSheet) {
      return { success: false, error: "未找到指定的 sheet" };
    }

    // 2. 获取字段信息
    const fieldsUrl = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/get_fields?access_token=${accessToken}`;
    const fieldsRes = await fetch(fieldsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        docid: docId,
        sheet_id: targetSheet.sheet_id,
      }),
    });
    const fieldsData = await fieldsRes.json() as any;

    const fields = fieldsData.fields || [];

    // 3. 获取记录数据
    const recordsUrl = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/get_records?access_token=${accessToken}`;
    const recordsRes = await fetch(recordsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docid: docId,
        sheet_id: targetSheet.sheet_id,
        limit: 100, // 每次最多 100 条
      }),
    });
    const recordsData = await recordsRes.json() as any;

    if (recordsData.errcode && recordsData.errcode !== 0) {
      return { success: false, error: `获取记录失败: ${recordsData.errcode} - ${recordsData.errmsg}` };
    }

    return {
      success: true,
      fields,
      records: recordsData.records || [],
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 读取文档内容
 */
export async function readDocument(
  cfg: OpenClawConfig,
  docId: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/document/get?access_token=${accessToken}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docid: docId }),
    });

    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    // 文档内容在 data.document 中，需要解析
    const document = data.document;
    if (!document) {
      return { success: true, content: "" };
    }

    // 简单提取文本内容
    let content = "";
    if (document.body?.blocks) {
      for (const block of document.body.blocks) {
        if (block.paragraph?.elements) {
          for (const elem of block.paragraph.elements) {
            if (elem.text_run?.text) {
              content += elem.text_run.text;
            }
          }
          content += "\n";
        }
      }
    }

    return { success: true, content: content.trim() };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 获取客户列表
 */
export async function getExternalContactList(
  cfg: OpenClawConfig,
  userId: string
): Promise<{ success: boolean; contactIds?: string[]; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/list?access_token=${accessToken}&userid=${userId}`;

    const res = await fetch(url);
    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    return { success: true, contactIds: data.external_userid || [] };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 获取客户详情
 */
export async function getExternalContactDetail(
  cfg: OpenClawConfig,
  externalUserId: string
): Promise<{ success: boolean; contact?: any; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get?access_token=${accessToken}&external_userid=${externalUserId}`;

    const res = await fetch(url);
    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    return {
      success: true,
      contact: {
        externalContact: data.external_contact,
        followUser: data.follow_user,
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
