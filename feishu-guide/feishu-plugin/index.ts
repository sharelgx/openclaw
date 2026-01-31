import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { feishuPlugin } from "./src/channel.js";
import { setFeishuRuntime } from "./src/runtime.js";
import { getActiveFeishuChat, syncMessageToFeishu } from "./src/sync-service.js";

const plugin = {
  id: "feishu",
  name: "飞书",
  description: "飞书频道插件 (Feishu/Lark)，使用长连接接收事件",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setFeishuRuntime(api.runtime);
    api.registerChannel({ plugin: feishuPlugin });

    // 注册消息发送钩子，实现双向同步
    api.registerHook(
      "message_sent",
      async (event: any) => {
        // 只同步非飞书来源的消息到飞书
        const channel = event.channel || event.provider;
        if (channel === "feishu") {
          return; // 飞书自己发的消息不需要再同步回去
        }

        const activeChat = getActiveFeishuChat();
        if (!activeChat) {
          return; // 没有活跃的飞书聊天
        }

        // 同步 AI 回复到飞书
        const content = event.content || event.text;
        if (content && typeof content === "string") {
          try {
            await syncMessageToFeishu(content);
            api.logger.info(`[feishu-sync] 已同步消息到飞书: ${content.slice(0, 30)}...`);
          } catch (err) {
            api.logger.error(`[feishu-sync] 同步失败: ${String(err)}`);
          }
        }
      },
      { name: "feishu-message-sync" }
    );

    api.logger.info("飞书插件已加载（长连接模式，无需 webhook 地址）");
  },
};

export default plugin;
