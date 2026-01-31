# 配置文件示例

本目录包含 Clawdbot 配置文件示例。

## 文件说明

- **[clawdbot.json](clawdbot.json)** - 完整配置示例
  - 包含所有推荐配置项
  - 支持多个模型
  - 配置了消息防抖
  - 适合生产环境

- **[clawdbot.minimal.json](clawdbot.minimal.json)** - 最小配置示例
  - 只包含必需配置项
  - 快速开始使用
  - 适合测试和学习

## 使用方法

### 方法一：使用配置向导（推荐）

回到仓库根目录运行：

```bash
./configure.sh
```

### 方法二：复制示例文件

```bash
# 复制最小配置
cp config-examples/clawdbot.minimal.json ~/.clawdbot/clawdbot.json

# 或复制完整配置
cp config-examples/clawdbot.json ~/.clawdbot/clawdbot.json
```

### 方法三：手动编辑

```bash
nano ~/.clawdbot/clawdbot.json
```

## 配置项说明

### 必需配置

#### 1. 模型提供商

```json
{
  "models": {
    "providers": {
      "my-api": {
        "baseUrl": "https://your-api-endpoint.com",
        "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
        "api": "anthropic-messages",
        "models": [...]
      }
    }
  }
}
```

**字段说明：**
- `baseUrl`: API 端点地址
  - Claude API: `https://api.anthropic.com`
  - 中转站: 根据提供商文档
  - 本地模型: `http://localhost:11434/v1`
- `apiKey`: API 密钥
- `api`: API 类型
  - `anthropic-messages`: Claude / 兼容 API
  - `openai-completions`: OpenAI / 兼容 API

#### 2. 飞书频道

```json
{
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

**字段说明：**
- `appId`: 飞书应用 App ID
- `appSecret`: 飞书应用 App Secret
- `dmPolicy`: 私聊策略
  - `pairing`: 需要配对（推荐）
  - `allowlist`: 白名单模式
  - `open`: 开放模式（不推荐）
- `allowFrom`: 白名单用户 ID 列表

#### 3. 插件配置

```json
{
  "plugins": {
    "entries": {
      "feishu": {
        "enabled": true
      }
    }
  }
}
```

### 可选配置

#### 1. 消息防抖

```json
{
  "messages": {
    "inbound": {
      "debounceMs": 1000,
      "byChannel": {
        "feishu": 500
      }
    }
  }
}
```

**说明：**
- 防止用户快速连续发送多条消息时重复处理
- `debounceMs`: 全局防抖时间（毫秒）
- `byChannel`: 各频道专用防抖时间

#### 2. Gateway 配置

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "loopback"
  }
}
```

**说明：**
- `mode`: 运行模式（通常为 `local`）
- `port`: Gateway 监听端口
- `bind`: 绑定地址（`loopback` 表示仅本地访问）

#### 3. 多模型配置

```json
{
  "agents": {
    "defaults": {
      "model": { 
        "primary": "my-api/claude-sonnet-4",
        "fast": "my-api/claude-haiku-3-5"
      }
    }
  }
}
```

**说明：**
- `primary`: 主要模型
- `fast`: 快速模型（用于简单任务）

## 不同 API 提供商配置

### Claude API（官方）

```json
{
  "models": {
    "providers": {
      "claude": {
        "baseUrl": "https://api.anthropic.com",
        "apiKey": "sk-ant-xxxxxxxxxxxxxxxxxxxxx",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "claude-sonnet-4-20250514",
            "name": "Claude Sonnet 4",
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  }
}
```

### 中转站 API

```json
{
  "models": {
    "providers": {
      "proxy": {
        "baseUrl": "https://your-proxy-api.com",
        "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
        "api": "anthropic-messages",
        "models": [...]
      }
    }
  }
}
```

### OpenAI API

```json
{
  "models": {
    "providers": {
      "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
        "api": "openai-completions",
        "models": [
          {
            "id": "gpt-4-turbo",
            "name": "GPT-4 Turbo",
            "contextWindow": 128000,
            "maxTokens": 4096
          }
        ]
      }
    }
  }
}
```

### 本地模型（Ollama）

```json
{
  "models": {
    "providers": {
      "ollama": {
        "baseUrl": "http://localhost:11434/v1",
        "apiKey": "ollama",
        "api": "openai-completions",
        "models": [
          {
            "id": "llama3.1:70b",
            "name": "Llama 3.1 70B",
            "contextWindow": 128000,
            "maxTokens": 4096
          }
        ]
      }
    }
  }
}
```

## 验证配置

运行诊断命令：

```bash
clawdbot doctor
```

或验证 JSON 格式：

```bash
cat ~/.clawdbot/clawdbot.json | python -m json.tool
```

## 相关文档

- [模型配置详解](../docs/02-model-configuration.md)
- [飞书应用设置](../docs/03-feishu-app-setup.md)
- [故障排查](../docs/06-troubleshooting.md)
