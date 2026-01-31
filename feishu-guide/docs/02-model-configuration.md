# 02. 配置模型提供商

Clawdbot 支持多种 AI 模型提供商。本文档介绍如何配置不同的 API。

## 支持的 API 类型

- **anthropic-messages** - Claude API 或兼容的中转站
- **openai-completions** - OpenAI API 或本地模型

## 配置方式

### 方法一：使用配置向导（推荐）

运行本仓库提供的配置向导：

```bash
./configure.sh
```

向导会交互式地询问：
1. 选择 API 类型
2. 输入 API URL
3. 输入 API Key
4. 自动生成配置文件

### 方法二：手动编辑配置文件

编辑 `~/.clawdbot/clawdbot.json`：

## 配置示例

### 1. Claude API（官方）

```json
{
  "models": {
    "mode": "merge",
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
          },
          {
            "id": "claude-opus-4-20250514",
            "name": "Claude Opus 4",
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "claude/claude-sonnet-4-20250514" }
    }
  }
}
```

**获取 API Key：**
1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册并创建 API Key
3. 复制 Key（格式：`sk-ant-...`）

### 2. 中转站 API

中转站通常提供兼容 Claude API 的接口，价格更低：

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "my-proxy": {
        "baseUrl": "https://your-proxy-api.com",
        "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "claude-sonnet-4-5-20250929",
            "name": "Claude Sonnet 4.5",
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "my-proxy/claude-sonnet-4-5-20250929" }
    }
  }
}
```

**常见中转站：**
- API2D
- CloseAI
- OhMyGPT
- 各种自建中转站

**注意事项：**
- 确保中转站支持 `anthropic-messages` API 格式
- 检查 `baseUrl` 是否正确（通常不需要 `/v1` 后缀）
- 验证 `apiKey` 格式

### 3. OpenAI API

```json
{
  "models": {
    "mode": "merge",
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

### 4. 本地模型（Ollama）

```json
{
  "models": {
    "mode": "merge",
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

**安装 Ollama：**
```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# 拉取模型
ollama pull llama3.1:70b
```

### 5. 多个提供商

可以配置多个提供商并自由切换：

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "claude": {
        "baseUrl": "https://api.anthropic.com",
        "apiKey": "sk-ant-xxxxx",
        "api": "anthropic-messages",
        "models": [...]
      },
      "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "sk-xxxxx",
        "api": "openai-completions",
        "models": [...]
      },
      "ollama": {
        "baseUrl": "http://localhost:11434/v1",
        "apiKey": "ollama",
        "api": "openai-completions",
        "models": [...]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { 
        "primary": "claude/claude-sonnet-4",
        "fast": "ollama/llama3.1:70b"
      }
    }
  }
}
```

## 测试配置

### 1. 验证配置文件

```bash
clawdbot doctor
```

### 2. 测试模型连接

启动 Gateway 并查看日志：

```bash
clawdbot gateway --verbose
```

应该看到类似输出：

```
[gateway] agent model: my-proxy/claude-sonnet-4-5-20250929
```

### 3. 发送测试消息

如果已配置 Telegram 或其他渠道，发送消息测试：

```
你好，请介绍一下你自己
```

## 常见问题

### Q: 如何知道使用哪种 API 类型？

**A:** 查看你的 API 提供商文档：
- Claude API 或兼容接口 → `anthropic-messages`
- OpenAI API 或兼容接口 → `openai-completions`
- 本地模型（Ollama） → `openai-completions`

### Q: baseUrl 应该包含 /v1 吗？

**A:** 取决于提供商：
- **anthropic-messages**：通常**不需要** `/v1`
  - ✅ `https://api.anthropic.com`
  - ❌ `https://api.anthropic.com/v1`
- **openai-completions**：通常**需要** `/v1`
  - ✅ `https://api.openai.com/v1`
  - ✅ `http://localhost:11434/v1`

### Q: API Key 格式不正确

**A:** 不同提供商的 Key 格式不同：
- Claude: `sk-ant-...`
- OpenAI: `sk-...`
- 中转站: 通常是 `sk-...` 或自定义格式

### Q: 如何切换模型？

**A:** 在对话中使用命令：

```
/model openai/gpt-4-turbo
```

或编辑配置文件中的 `agents.defaults.model.primary`。

### Q: 配置多个模型后如何选择？

**A:** 
1. 设置默认模型（`agents.defaults.model.primary`）
2. 对话中使用 `/model` 命令切换
3. 配置不同的 agent 使用不同模型

## 下一步

配置好模型后，继续：

- [03. 创建飞书应用](03-feishu-app-setup.md) - 在飞书开放平台创建应用
- [返回主文档](../README.md)

## 相关资源

- [Anthropic API 文档](https://docs.anthropic.com/)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [Ollama 官网](https://ollama.com/)
