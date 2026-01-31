# 飞书 Clawdbot 插件

飞书（Feishu/Lark）频道插件，使用**长连接（WebSocket）**接收事件。

## 特点

- ✅ 使用长连接，无需公网域名
- ✅ 无需配置 Webhook 和加密
- ✅ 支持接收和发送消息
- ✅ 支持配对授权模式
- ✅ 完整的 TypeScript 类型支持

## 安装

### 自动安装（推荐）

回到仓库根目录运行：

```bash
./install-plugin.sh
```

### 手动安装

```bash
# 复制文件
cp -r feishu-plugin ~/.clawdbot/extensions/feishu

# 安装依赖
cd ~/.clawdbot/extensions/feishu
npm install
```

## 文件结构

```
feishu-plugin/
├── clawdbot.plugin.json    # 插件清单
├── package.json             # 依赖配置
├── index.ts                 # 插件入口
├── README.md                # 本文件
└── src/
    ├── channel.ts           # 频道插件定义
    ├── runtime.ts           # Runtime 管理
    ├── feishu-ws.ts         # 长连接实现
    └── send.ts              # 消息发送
```

## 核心文件说明

### index.ts

插件入口，注册频道插件：

```typescript
import { feishuPlugin } from "./src/channel.js";
import { setFeishuRuntime } from "./src/runtime.js";

const plugin = {
  id: "feishu",
  name: "飞书",
  description: "飞书频道插件，使用长连接接收事件",
  register(api) {
    setFeishuRuntime(api.runtime);
    api.registerChannel({ plugin: feishuPlugin });
  },
};

export default plugin;
```

### src/channel.ts

定义频道插件，包括：
- 插件元数据
- 配置 schema
- Gateway 启动方法（`gateway.startAccount`）

### src/feishu-ws.ts

长连接核心实现：
- 使用 `@larksuiteoapi/node-sdk` 的 `WSClient`
- 创建 `EventDispatcher` 处理事件
- 使用 `createInboundDebouncer` 处理消息防抖
- 调用 `dispatchReplyFromConfig` 处理 AI 回复

### src/send.ts

消息发送功能：
- 使用 Lark SDK 发送消息
- 支持文本消息
- 支持回复消息（`replyToId`）

### src/runtime.ts

Runtime 管理，提供对 Clawdbot 核心功能的访问。

## 配置

在 `~/.clawdbot/clawdbot.json` 中配置：

```json
{
  "plugins": {
    "entries": {
      "feishu": {
        "enabled": true
      }
    }
  },
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxxxxxxxxxxxxxxx",
      "appSecret": "xxxxxxxxxxxxxxxxxxxxxx",
      "dmPolicy": "pairing",
      "allowFrom": []
    }
  }
}
```

## 开发

### 本地开发

```bash
# 链接到开发目录
ln -s /path/to/feishu-clawdbot-guide/feishu-plugin ~/.clawdbot/extensions/feishu

# 安装依赖
cd ~/.clawdbot/extensions/feishu
npm install

# 启动 Gateway（会自动加载插件）
clawdbot gateway --verbose
```

### 调试

查看插件日志：

```bash
tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log | grep feishu
```

### 修改插件

修改源代码后，重启 Gateway 即可生效：

```bash
clawdbot gateway stop
clawdbot gateway --verbose
```

## 依赖

- `@larksuiteoapi/node-sdk`: 飞书官方 Node.js SDK
- `clawdbot/plugin-sdk`: Clawdbot 插件 SDK（由 Clawdbot 提供）

## 许可证

MIT License

## 相关资源

- [飞书开放平台](https://open.feishu.cn)
- [飞书 Node.js SDK](https://github.com/larksuite/node-sdk)
- [Clawdbot 文档](https://clawd.bot)
