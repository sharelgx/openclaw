/**
 * 飞书-WebChat 消息同步服务
 * 实现双向消息同步
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { sendMessageFeishu } from "./send.js";

// 全局状态：保存当前活跃的飞书聊天
interface FeishuChatState {
  userId: string;        // 飞书用户 open_id
  chatId: string;        // 飞书聊天 ID
  accountId: string;     // 账户 ID
  lastMessageId?: string;
}

// 单例：当前活跃的飞书聊天
let activeFeishuChat: FeishuChatState | null = null;
let configRef: OpenClawConfig | null = null;

/**
 * 设置当前活跃的飞书聊天
 */
export function setActiveFeishuChat(state: FeishuChatState, cfg: OpenClawConfig): void {
  activeFeishuChat = state;
  configRef = cfg;
  console.log(`[feishu-sync] 活跃聊天已设置: userId=${state.userId}`);
}

/**
 * 获取当前活跃的飞书聊天
 */
export function getActiveFeishuChat(): FeishuChatState | null {
  return activeFeishuChat;
}

/**
 * 获取配置
 */
export function getFeishuConfig(): OpenClawConfig | null {
  return configRef;
}

/**
 * 清除活跃聊天
 */
export function clearActiveFeishuChat(): void {
  activeFeishuChat = null;
  configRef = null;
}

/**
 * 将消息同步到飞书
 * @param text 消息文本
 * @param cfg 可选的配置，如果不提供则使用缓存的配置
 */
export async function syncMessageToFeishu(text: string, cfg?: OpenClawConfig): Promise<boolean> {
  if (!activeFeishuChat) {
    console.log("[feishu-sync] 没有活跃的飞书聊天，跳过同步");
    return false;
  }

  const effectiveCfg = cfg || configRef;
  if (!effectiveCfg) {
    console.log("[feishu-sync] 没有配置，跳过同步");
    return false;
  }

  try {
    const to = `user:${activeFeishuChat.userId}`;
    await sendMessageFeishu(to, text, {
      cfg: effectiveCfg,
      accountId: activeFeishuChat.accountId,
    });
    console.log(`[feishu-sync] 消息已同步到飞书: ${text.slice(0, 50)}...`);
    return true;
  } catch (err) {
    console.error(`[feishu-sync] 同步到飞书失败: ${String(err)}`);
    return false;
  }
}
