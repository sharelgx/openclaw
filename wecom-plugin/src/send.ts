/**
 * 企业微信消息发送
 * 通过云服务器中转发送，避免本地 IP 白名单问题
 */
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { sendMessageViaRelay, getSharedWebSocket } from "./ws-connection.js";

export interface SendMessageOptions {
  cfg: OpenClawConfig;
  accountId: string;
  replyToId?: string;
}

/**
 * 发送文本消息（通过云服务器中转）
 */
export async function sendTextMessage(
  to: string,
  content: string,
  options: SendMessageOptions
): Promise<{ messageId: string }> {
  return sendMessageViaRelay(to, content);
}

/**
 * 发送 Markdown 消息（通过云服务器中转）
 */
export async function sendMarkdownMessage(
  to: string,
  content: string,
  options: SendMessageOptions
): Promise<{ messageId: string }> {
  // 企业微信 Markdown 支持有限，统一用文本
  return sendMessageViaRelay(to, content);
}

/**
 * 发送消息（通过云服务器中转）
 */
export async function sendMessageWecom(
  to: string,
  content: string,
  options: SendMessageOptions
): Promise<{ messageId: string }> {
  return sendMessageViaRelay(to, content);
}
