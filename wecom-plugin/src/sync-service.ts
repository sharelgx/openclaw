/**
 * 企业微信消息同步服务
 */
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { sendMessageWecom } from "./send.js";

export interface ActiveWecomChat {
  userId: string;
  chatId?: string;
  accountId: string;
  lastMessageId?: string;
}

let activeChat: ActiveWecomChat | null = null;
let currentConfig: OpenClawConfig | null = null;

/**
 * 设置当前活跃的企业微信聊天
 */
export function setActiveWecomChat(chat: ActiveWecomChat, cfg: OpenClawConfig) {
  activeChat = chat;
  currentConfig = cfg;
}

/**
 * 获取当前活跃的企业微信聊天
 */
export function getActiveWecomChat(): ActiveWecomChat | null {
  return activeChat;
}

/**
 * 获取企业微信配置
 */
export function getWecomConfig(): OpenClawConfig | null {
  return currentConfig;
}

/**
 * 同步消息到企业微信
 */
export async function syncMessageToWecom(content: string): Promise<void> {
  if (!activeChat || !currentConfig) {
    throw new Error("没有活跃的企业微信聊天");
  }

  const to = activeChat.chatId
    ? `chat:${activeChat.chatId}`
    : `user:${activeChat.userId}`;

  await sendMessageWecom(to, content, {
    cfg: currentConfig,
    accountId: activeChat.accountId,
  });
}

/**
 * 清除活跃聊天
 */
export function clearActiveWecomChat() {
  activeChat = null;
  currentConfig = null;
}
