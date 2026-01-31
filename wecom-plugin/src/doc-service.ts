/**
 * 企业微信文档服务
 * 支持读取智能表格、智能文档
 */
import type { OpenClawConfig } from "openclaw/plugin-sdk";

// Access Token 缓存
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * 获取企业微信 Access Token
 */
async function getAccessToken(cfg: OpenClawConfig): Promise<string> {
  // 检查缓存是否有效（提前 5 分钟刷新）
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedAccessToken;
  }

  // 从配置中获取企业微信凭证
  const wecomConfig = (cfg as any).channels?.wecom;
  if (!wecomConfig) {
    throw new Error("企业微信配置未找到");
  }

  const { corpId, corpSecret } = wecomConfig;
  if (!corpId || !corpSecret) {
    throw new Error("企业微信 corpId 或 corpSecret 未配置");
  }

  // 调用企业微信 API 获取 token
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`;
  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`获取 access_token 失败: ${data.errcode} - ${data.errmsg}`);
  }

  // 缓存 token
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 7200) * 1000;

  return cachedAccessToken;
}

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
 * 获取配置了客户联系功能的成员列表
 */
export async function getFollowUserList(
  cfg: OpenClawConfig
): Promise<{ success: boolean; userIds?: string[]; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get_follow_user_list?access_token=${accessToken}`;

    const res = await fetch(url);
    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    return { success: true, userIds: data.follow_user || [] };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 获取所有客户（自动获取所有成员的客户）
 */
export async function getAllCustomers(
  cfg: OpenClawConfig
): Promise<{ success: boolean; customers?: any[]; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    
    // 1. 获取配置了客户联系功能的成员列表
    const followUserResult = await getFollowUserList(cfg);
    if (!followUserResult.success || !followUserResult.userIds?.length) {
      return { success: false, error: followUserResult.error || "没有配置客户联系功能的成员" };
    }

    const allCustomers: any[] = [];
    const seenCustomerIds = new Set<string>();

    // 2. 遍历每个成员，获取其客户列表
    for (const userId of followUserResult.userIds) {
      const listUrl = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/list?access_token=${accessToken}&userid=${userId}`;
      const listRes = await fetch(listUrl);
      const listData = await listRes.json() as any;

      if (listData.errcode !== 0 || !listData.external_userid) {
        continue;
      }

      // 3. 获取每个客户的详细信息
      for (const externalUserId of listData.external_userid) {
        if (seenCustomerIds.has(externalUserId)) {
          continue; // 跳过重复的客户
        }
        seenCustomerIds.add(externalUserId);

        const detailUrl = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get?access_token=${accessToken}&external_userid=${externalUserId}`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json() as any;

        if (detailData.errcode === 0 && detailData.external_contact) {
          allCustomers.push({
            externalUserId,
            ...detailData.external_contact,
            followUsers: detailData.follow_user,
          });
        }
      }
    }

    return { success: true, customers: allCustomers };
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
 * 创建智能表格
 */
export async function createSmartSheet(
  cfg: OpenClawConfig,
  title: string,
  adminUserIds?: string[]
): Promise<{ success: boolean; docId?: string; url?: string; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/create_doc?access_token=${accessToken}`;

    const body: any = {
      doc_type: 4, // 4 = 智能表格
      doc_name: title,
    };

    if (adminUserIds && adminUserIds.length > 0) {
      body.admin_users = adminUserIds;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    return {
      success: true,
      docId: data.docid,
      url: data.url,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 添加智能表格字段
 */
export async function addSmartSheetField(
  cfg: OpenClawConfig,
  docId: string,
  sheetId: string,
  fieldTitle: string,
  fieldType: string = "text"
): Promise<{ success: boolean; fieldId?: string; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/add_fields?access_token=${accessToken}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docid: docId,
        sheet_id: sheetId,
        fields: [{
          field_title: fieldTitle,
          field_type: fieldType,
        }],
      }),
    });

    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    const fields = data.fields || [];
    return {
      success: true,
      fieldId: fields[0]?.field_id,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 添加智能表格记录
 */
export async function addSmartSheetRecord(
  cfg: OpenClawConfig,
  docId: string,
  sheetId: string,
  values: Record<string, any>
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/add_records?access_token=${accessToken}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docid: docId,
        sheet_id: sheetId,
        records: [{
          values,
        }],
      }),
    });

    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    const records = data.records || [];
    return {
      success: true,
      recordId: records[0]?.record_id,
    };
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

/**
 * 创建智能文档
 * doc_type: 3=文档, 4=表格, 10=智能表格
 */
export async function createWecomDocument(
  cfg: OpenClawConfig,
  title: string,
  adminUserIds?: string[]
): Promise<{ success: boolean; docId?: string; url?: string; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/create_doc?access_token=${accessToken}`;

    const body: any = {
      doc_type: 3, // 3 = 智能文档
      doc_name: title,
    };

    if (adminUserIds && adminUserIds.length > 0) {
      body.admin_users = adminUserIds;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    return {
      success: true,
      docId: data.docid,
      url: data.url,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 删除文档（文档、表格、智能表格都可以）
 */
export async function deleteWecomDocument(
  cfg: OpenClawConfig,
  docId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/del_doc?access_token=${accessToken}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docid: docId }),
    });

    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 编辑智能文档内容（追加或替换）
 * 使用 batch_update API
 */
export async function editWecomDocument(
  cfg: OpenClawConfig,
  docId: string,
  content: string,
  mode: "append" | "replace" = "append"
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    
    // 1. 先获取文档数据以获取版本号和位置
    const getUrl = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/document/get?access_token=${accessToken}`;
    const getRes = await fetch(getUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docid: docId }),
    });
    const getData = await getRes.json() as any;

    if (getData.errcode && getData.errcode !== 0) {
      return { success: false, error: `获取文档失败: ${getData.errcode} - ${getData.errmsg}` };
    }

    const version = getData.version || 1;
    const document = getData.document;
    
    // 计算文档末尾位置
    let endIndex = 1; // 默认位置
    if (document?.body?.blocks) {
      for (const block of document.body.blocks) {
        if (block.paragraph) {
          endIndex = Math.max(endIndex, (block.paragraph.location?.end_index || 0) + 1);
        }
      }
    }

    // 2. 构建更新请求
    const requests: any[] = [];
    
    if (mode === "replace") {
      // 替换模式：先删除所有内容，再插入新内容
      if (endIndex > 1) {
        requests.push({
          delete_content: {
            range: { start_index: 0, length: endIndex - 1 }
          }
        });
      }
      requests.push({
        insert_text: {
          text: content,
          location: { index: 0 }
        }
      });
    } else {
      // 追加模式：在末尾插入新段落和内容
      requests.push({
        insert_paragraph: {
          location: { index: endIndex }
        }
      });
      requests.push({
        insert_text: {
          text: content,
          location: { index: endIndex + 1 }
        }
      });
    }

    // 3. 执行更新
    const updateUrl = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/document/batch_update?access_token=${accessToken}`;
    const updateRes = await fetch(updateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docid: docId,
        version: version,
        requests: requests,
      }),
    });

    const updateData = await updateRes.json() as any;

    if (updateData.errcode && updateData.errcode !== 0) {
      return { success: false, error: `编辑文档失败: ${updateData.errcode} - ${updateData.errmsg}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 更新智能表格记录
 */
export async function updateSmartSheetRecord(
  cfg: OpenClawConfig,
  docId: string,
  sheetId: string,
  recordId: string,
  values: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/update_records?access_token=${accessToken}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docid: docId,
        sheet_id: sheetId,
        records: [{
          record_id: recordId,
          values,
        }],
      }),
    });

    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 删除智能表格记录
 */
export async function deleteSmartSheetRecord(
  cfg: OpenClawConfig,
  docId: string,
  sheetId: string,
  recordIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/del_records?access_token=${accessToken}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docid: docId,
        sheet_id: sheetId,
        record_ids: recordIds,
      }),
    });

    const data = await res.json() as any;

    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: `${data.errcode} - ${data.errmsg}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
