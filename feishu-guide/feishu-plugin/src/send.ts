/**
 * 飞书消息发送
 * 支持纯文本和交互式卡片消息，支持流式更新
 */
import * as Lark from "@larksuiteoapi/node-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";

export type FeishuButton = {
  text: string;
  value: string;
  type?: "primary" | "default" | "danger";
};

export type SendFeishuMessageOpts = {
  accountId?: string;
  replyToId?: string;
  cfg?: OpenClawConfig;
  /** 使用卡片消息格式 */
  useCard?: boolean;
  /** 卡片标题 */
  cardTitle?: string;
  /** 卡片按钮 */
  buttons?: FeishuButton[];
};

// 缓存 Lark Client 实例
const clientCache = new Map<string, Lark.Client>();

function getFeishuClient(appId: string, appSecret: string): Lark.Client {
  const key = `${appId}:${appSecret}`;
  let client = clientCache.get(key);
  if (!client) {
    client = new Lark.Client({
      appId,
      appSecret,
      appType: Lark.AppType.SelfBuild,
      domain: Lark.Domain.Feishu,
    });
    clientCache.set(key, client);
  }
  return client;
}

/**
 * 发送"正在思考"状态消息
 * 返回 messageId 用于后续更新
 */
export async function sendThinkingStatus(
  to: string,
  opts: { cfg?: OpenClawConfig; accountId?: string } = {}
): Promise<{ messageId: string; client: Lark.Client }> {
  const cfg = opts.cfg;
  if (!cfg) throw new Error("sendThinkingStatus: cfg is required");

  const feishuConfig = cfg.channels?.feishu as any;
  const appId = feishuConfig?.appId;
  const appSecret = feishuConfig?.appSecret;
  if (!appId || !appSecret) throw new Error("appId/appSecret not configured");

  const client = getFeishuClient(appId, appSecret);

  let receiveId = to;
  let receiveIdType: "chat_id" | "open_id" = "chat_id";
  if (to.startsWith("user:")) {
    receiveId = to.slice(5);
    receiveIdType = "open_id";
  }

  // 发送思考中的卡片
  const thinkingCard = JSON.stringify({
    config: { wide_screen_mode: true },
    elements: [
      {
        tag: "div",
        text: { tag: "lark_md", content: "⏳ **正在思考中...**" },
      },
    ],
  });

  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      msg_type: "interactive",
      content: thinkingCard,
    },
  });

  if (response.code !== 0) {
    throw new Error(`sendThinkingStatus failed: ${response.code} ${response.msg}`);
  }

  const messageId = response.data?.message_id;
  if (!messageId) throw new Error("Failed to get message_id");

  console.log(`[feishu] 已发送思考状态 messageId=${messageId}`);
  return { messageId, client };
}

/**
 * 更新已发送的消息（用于流式更新）
 */
export async function updateMessage(
  client: Lark.Client,
  messageId: string,
  text: string,
  isStreaming: boolean = true
): Promise<void> {
  const statusText = isStreaming ? "\n\n⏳ *生成中...*" : "";
  const card = JSON.stringify({
    config: { wide_screen_mode: true },
    elements: [
      {
        tag: "div",
        text: { tag: "lark_md", content: text + statusText },
      },
    ],
  });

  const response = await client.im.message.patch({
    path: { message_id: messageId },
    data: { content: card },
  });

  if (response.code !== 0) {
    console.error(`[feishu] 更新消息失败: ${response.code} ${response.msg}`);
  }
}

/**
 * 构建飞书交互式卡片
 * 注意：由于没有配置卡片回调地址，按钮会转换为选项列表展示
 */
function buildInteractiveCard(
  text: string,
  title?: string,
  buttons?: FeishuButton[]
): string {
  // 将文本按段落分割成多个 div 元素
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const elements: any[] = paragraphs.map(para => ({
    tag: "div",
    text: {
      tag: "lark_md",
      content: para.trim(),
    },
  }));
  
  // 将按钮转换为选项列表（因为没有回调服务器）
  if (buttons && buttons.length > 0) {
    // 添加分隔线
    elements.push({ tag: "hr" });
    
    // 添加选项提示
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: "**📋 请回复数字选择：**",
      },
    });
    
    // 用 column_set 创建选项按钮样式的展示
    const optionText = buttons.map(btn => `**[ ${btn.value} ]** ${btn.text.replace(/^\d+\.\s*/, "")}`).join("\n");
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md", 
        content: optionText,
      },
    });
  }
  
  const card: any = {
    config: { wide_screen_mode: true },
    elements,
  };
  
  if (title) {
    card.header = {
      title: { tag: "plain_text", content: title },
      template: "blue",
    };
  }
  
  return JSON.stringify(card);
}

/**
 * 从文本中解析按钮标记
 * 支持两种格式:
 * 1. [button:按钮文字:动作值:类型]
 * 2. [数字] 文字 (如 [1] 周一训练)
 */
function parseButtonsFromText(text: string): { cleanText: string; buttons: FeishuButton[] } {
  const buttons: FeishuButton[] = [];
  
  // 格式1: [button:文字:值:类型]
  const buttonRegex = /\[button:([^:\]]+):([^:\]]+)(?::(\w+))?\]/g;
  let match;
  while ((match = buttonRegex.exec(text)) !== null) {
    buttons.push({
      text: match[1],
      value: match[2],
      type: (match[3] as FeishuButton["type"]) || "default",
    });
  }
  let cleanText = text.replace(buttonRegex, "");
  
  // 格式2: [数字] 文字 或 [数字] 文字：描述
  // 匹配类似 "[1] 周一：上肢训练" 或 "[1] 查看详情"
  const numberButtonRegex = /\[(\d+)\]\s*([^：:\n\[]+?)(?=[：:\n\[]|$)/g;
  const numberButtons: FeishuButton[] = [];
  while ((match = numberButtonRegex.exec(text)) !== null) {
    const num = match[1];
    const label = match[2].trim();
    if (label && label.length < 20) { // 只转换短文本
      numberButtons.push({
        text: `${num}. ${label}`,
        value: num,
        type: "default",
      });
    }
  }
  
  // 如果找到了数字格式的按钮，添加到按钮列表
  if (numberButtons.length > 0 && numberButtons.length <= 6) {
    buttons.push(...numberButtons);
    // 移除原文中的 [数字] 选项行
    cleanText = cleanText.replace(/\[(\d+)\]\s*[^\n]+\n?/g, "");
  }
  
  return { cleanText: cleanText.trim(), buttons };
}

/**
 * 发送飞书消息
 * @param to - 目标 chatId 或 user:userId 格式
 * @param text - 消息文本（可包含 [button:文字:值:类型] 格式的按钮标记）
 * @param opts - 选项
 */
export async function sendMessageFeishu(
  to: string,
  text: string,
  opts: SendFeishuMessageOpts = {}
): Promise<void> {
  const cfg = opts.cfg;
  if (!cfg) {
    throw new Error("sendMessageFeishu: cfg is required");
  }

  // 解析目标
  let receiveId = to;
  let receiveIdType: "chat_id" | "open_id" | "user_id" = "chat_id";

  if (to.startsWith("user:")) {
    receiveId = to.slice(5);
    receiveIdType = "open_id";
  }

  // 获取飞书配置
  const accountId = opts.accountId ?? "default";
  const feishuConfig = cfg.channels?.feishu as
    | {
        appId?: string;
        appSecret?: string;
        useCard?: boolean;
        accounts?: Record<string, { appId?: string; appSecret?: string }>;
      }
    | undefined;

  let appId: string | undefined;
  let appSecret: string | undefined;

  if (accountId !== "default" && feishuConfig?.accounts?.[accountId]) {
    appId = feishuConfig.accounts[accountId].appId;
    appSecret = feishuConfig.accounts[accountId].appSecret;
  } else {
    appId = feishuConfig?.appId;
    appSecret = feishuConfig?.appSecret;
  }

  if (!appId || !appSecret) {
    throw new Error(`sendMessageFeishu: appId or appSecret not configured for account ${accountId}`);
  }

  // 创建客户端
  const client = new Lark.Client({
    appId,
    appSecret,
    appType: Lark.AppType.SelfBuild,
    domain: Lark.Domain.Feishu,
  });

  // 解析文本中的按钮
  const { cleanText, buttons: parsedButtons } = parseButtonsFromText(text);
  const allButtons = [...(opts.buttons || []), ...parsedButtons];
  
  // 决定是否使用卡片格式
  const shouldUseCard = opts.useCard || 
    feishuConfig?.useCard || 
    allButtons.length > 0 || 
    cleanText.length > 500;

  let msgType: string;
  let content: string;

  if (shouldUseCard) {
    msgType = "interactive";
    content = buildInteractiveCard(cleanText, opts.cardTitle, allButtons);
    console.log(`[feishu] 发送卡片消息到 ${receiveId}: ${cleanText.slice(0, 50)}...`);
  } else {
    msgType = "text";
    content = JSON.stringify({ text: cleanText });
    console.log(`[feishu] 发送文本消息到 ${receiveId}: ${cleanText.slice(0, 50)}...`);
  }

  // 发送消息
  const response = await client.im.message.create({
    params: {
      receive_id_type: receiveIdType,
    },
    data: {
      receive_id: receiveId,
      msg_type: msgType,
      content,
    },
  });

  if (response.code !== 0) {
    throw new Error(`sendMessageFeishu failed: ${response.code} ${response.msg}`);
  }
  
  console.log(`[feishu] 消息发送成功 (${msgType})`);
}
