/**
 * 飞书消息发送
 */
import * as Lark from "@larksuiteoapi/node-sdk";
import type { ClawdbotConfig } from "clawdbot/plugin-sdk";

export type SendFeishuMessageOpts = {
  accountId?: string;
  replyToId?: string;
  cfg?: ClawdbotConfig;
};

/**
 * 发送飞书消息
 * @param to - 目标 chatId 或 user:userId 格式
 * @param text - 消息文本
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
    receiveId = to.slice(5); // 移除 "user:" 前缀
    receiveIdType = "open_id";
  }

  // 获取飞书配置
  const accountId = opts.accountId ?? "default";
  const feishuConfig = cfg.channels?.feishu as
    | {
        appId?: string;
        appSecret?: string;
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

  // 构建消息内容
  const content = JSON.stringify({ text });

  // 发送消息
  const response = await client.im.message.create({
    params: {
      receive_id_type: receiveIdType,
    },
    data: {
      receive_id: receiveId,
      msg_type: "text",
      content,
      ...(opts.replyToId ? { reply_to: opts.replyToId } : {}),
    },
  });

  if (!response.success) {
    throw new Error(
      `sendMessageFeishu failed: ${response.code} ${response.msg}`
    );
  }
}
