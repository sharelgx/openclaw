/**
 * 企业微信消息发送
 */
import type { OpenClawConfig } from "openclaw/plugin-sdk";

// Access Token 缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * 获取 Access Token
 */
export async function getAccessToken(cfg: OpenClawConfig): Promise<string> {
  const wecomConfig = cfg.channels?.wecom as any;
  const corpId = wecomConfig?.corpId;
  const corpSecret = wecomConfig?.corpSecret;

  if (!corpId || !corpSecret) {
    throw new Error("企业微信 corpId/corpSecret 未配置");
  }

  // 检查缓存
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  // 获取新 token
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`;
  const res = await fetch(url);
  const data = await res.json() as { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number };

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`获取 access_token 失败: ${data.errcode} - ${data.errmsg}`);
  }

  cachedToken = {
    token: data.access_token!,
    expiresAt: Date.now() + (data.expires_in! * 1000),
  };

  return cachedToken.token;
}

/**
 * 清除 Token 缓存
 */
export function clearTokenCache() {
  cachedToken = null;
}

export interface SendMessageOptions {
  cfg: OpenClawConfig;
  accountId: string;
  replyToId?: string;
}

/**
 * 发送文本消息
 */
export async function sendTextMessage(
  to: string,
  content: string,
  options: SendMessageOptions
): Promise<{ messageId: string }> {
  const wecomConfig = options.cfg.channels?.wecom as any;
  const agentId = wecomConfig?.agentId;

  if (!agentId) {
    throw new Error("企业微信 agentId 未配置");
  }

  const accessToken = await getAccessToken(options.cfg);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;

  // 解析接收者类型
  let toUser = "";
  let toChat = "";

  if (to.startsWith("user:")) {
    toUser = to.slice(5);
  } else if (to.startsWith("chat:")) {
    toChat = to.slice(5);
  } else {
    // 默认当作用户 ID
    toUser = to;
  }

  const body: any = {
    agentid: parseInt(agentId, 10),
    msgtype: "text",
    text: {
      content,
    },
    safe: 0,
  };

  if (toChat) {
    // 群聊
    body.chatid = toChat;
  } else {
    // 私聊
    body.touser = toUser;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { errcode?: number; errmsg?: string; msgid?: string };

  if (data.errcode && data.errcode !== 0) {
    // Token 过期，清除缓存重试
    if (data.errcode === 40014 || data.errcode === 42001) {
      clearTokenCache();
      return sendTextMessage(to, content, options);
    }
    throw new Error(`发送消息失败: ${data.errcode} - ${data.errmsg}`);
  }

  return { messageId: data.msgid || `wecom_${Date.now()}` };
}

/**
 * 发送 Markdown 消息（仅支持企业微信客户端）
 */
export async function sendMarkdownMessage(
  to: string,
  content: string,
  options: SendMessageOptions
): Promise<{ messageId: string }> {
  const wecomConfig = options.cfg.channels?.wecom as any;
  const agentId = wecomConfig?.agentId;

  if (!agentId) {
    throw new Error("企业微信 agentId 未配置");
  }

  const accessToken = await getAccessToken(options.cfg);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;

  let toUser = "";
  if (to.startsWith("user:")) {
    toUser = to.slice(5);
  } else {
    toUser = to;
  }

  const body = {
    touser: toUser,
    agentid: parseInt(agentId, 10),
    msgtype: "markdown",
    markdown: {
      content,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { errcode?: number; errmsg?: string; msgid?: string };

  if (data.errcode && data.errcode !== 0) {
    if (data.errcode === 40014 || data.errcode === 42001) {
      clearTokenCache();
      return sendMarkdownMessage(to, content, options);
    }
    throw new Error(`发送消息失败: ${data.errcode} - ${data.errmsg}`);
  }

  return { messageId: data.msgid || `wecom_${Date.now()}` };
}

/**
 * 发送消息（自动选择类型）
 */
export async function sendMessageWecom(
  to: string,
  content: string,
  options: SendMessageOptions
): Promise<{ messageId: string }> {
  // 目前统一使用文本消息，因为 Markdown 在微信客户端显示不佳
  return sendTextMessage(to, content, options);
}
