#!/bin/bash

# 飞书 Clawdbot 配置向导
# 交互式配置 API 和飞书信息

set -e

echo "================================================"
echo "⚙️  飞书 Clawdbot 配置向导"
echo "================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

CONFIG_FILE="$HOME/.clawdbot/clawdbot.json"
BACKUP_FILE="$HOME/.clawdbot/clawdbot.json.backup.$(date +%Y%m%d_%H%M%S)"

# 检查配置文件是否存在
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠ 发现现有配置文件${NC}"
    echo ""
    read -p "是否备份现有配置？(Y/n): " backup_choice
    backup_choice=${backup_choice:-Y}
    
    if [[ "$backup_choice" =~ ^[Yy]$ ]]; then
        cp "$CONFIG_FILE" "$BACKUP_FILE"
        echo -e "${GREEN}✓ 已备份到: $BACKUP_FILE${NC}"
    fi
    echo ""
fi

echo "================================================"
echo "📡 模型 API 配置"
echo "================================================"
echo ""
echo "请选择 API 类型："
echo "1) Claude API（官方）"
echo "2) 中转站 API（第三方）"
echo "3) 本地模型（Ollama 等）"
echo ""
read -p "请选择 (1-3): " api_choice

case $api_choice in
    1)
        API_TYPE="anthropic-messages"
        DEFAULT_BASE_URL="https://api.anthropic.com"
        echo ""
        echo -e "${BLUE}已选择：Claude API（官方）${NC}"
        ;;
    2)
        API_TYPE="anthropic-messages"
        DEFAULT_BASE_URL="https://your-proxy-api.com"
        echo ""
        echo -e "${BLUE}已选择：中转站 API${NC}"
        ;;
    3)
        API_TYPE="openai-completions"
        DEFAULT_BASE_URL="http://localhost:11434/v1"
        echo ""
        echo -e "${BLUE}已选择：本地模型${NC}"
        ;;
    *)
        echo -e "${RED}无效选择，使用默认：Claude API${NC}"
        API_TYPE="anthropic-messages"
        DEFAULT_BASE_URL="https://api.anthropic.com"
        ;;
esac

echo ""
read -p "API Base URL [$DEFAULT_BASE_URL]: " base_url
base_url=${base_url:-$DEFAULT_BASE_URL}

echo ""
read -p "API Key (将不显示): " -s api_key
echo ""

if [ -z "$api_key" ]; then
    echo -e "${RED}✗ API Key 不能为空${NC}"
    exit 1
fi

echo ""
echo "================================================"
echo "🚀 飞书应用配置"
echo "================================================"
echo ""
echo -e "${YELLOW}请先在飞书开放平台创建应用并获取以下信息：${NC}"
echo "https://open.feishu.cn/app"
echo ""

read -p "飞书 App ID: " app_id
if [ -z "$app_id" ]; then
    echo -e "${RED}✗ App ID 不能为空${NC}"
    exit 1
fi

echo ""
read -p "飞书 App Secret (将不显示): " -s app_secret
echo ""

if [ -z "$app_secret" ]; then
    echo -e "${RED}✗ App Secret 不能为空${NC}"
    exit 1
fi

echo ""
echo "================================================"
echo "🔒 访问控制配置"
echo "================================================"
echo ""
echo "DM（私聊）策略："
echo "1) pairing - 需要配对授权（推荐）"
echo "2) allowlist - 仅允许白名单用户"
echo "3) open - 允许所有人（不推荐）"
echo ""
read -p "请选择 (1-3) [1]: " dm_policy_choice
dm_policy_choice=${dm_policy_choice:-1}

case $dm_policy_choice in
    1)
        DM_POLICY="pairing"
        ;;
    2)
        DM_POLICY="allowlist"
        ;;
    3)
        DM_POLICY="open"
        ;;
    *)
        DM_POLICY="pairing"
        ;;
esac

echo ""
echo -e "${BLUE}已选择：$DM_POLICY${NC}"

echo ""
echo "================================================"
echo "💾 生成配置文件"
echo "================================================"
echo ""

# 确保目录存在
mkdir -p "$HOME/.clawdbot"

# 生成配置文件
cat > "$CONFIG_FILE" << EOF
{
  "agents": {
    "defaults": {
      "workspace": "~/clawd",
      "model": { "primary": "my-api/claude-sonnet-4" }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "my-api": {
        "baseUrl": "$base_url",
        "apiKey": "$api_key",
        "api": "$API_TYPE",
        "models": [
          {
            "id": "claude-sonnet-4",
            "name": "Claude Sonnet 4",
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
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
      "appId": "$app_id",
      "appSecret": "$app_secret",
      "dmPolicy": "$DM_POLICY",
      "allowFrom": []
    }
  },
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "loopback"
  }
}
EOF

echo -e "${GREEN}✓ 配置文件已生成: $CONFIG_FILE${NC}"
echo ""

echo "================================================"
echo "✅ 配置完成！"
echo "================================================"
echo ""
echo -e "${BLUE}下一步：${NC}"
echo ""
echo "1. 启动 Gateway："
echo -e "   ${GREEN}clawdbot gateway --verbose${NC}"
echo ""
echo "2. 在飞书开放平台配置长连接："
echo "   - 访问：https://open.feishu.cn/app"
echo "   - 进入你的应用 → 事件与回调 → 事件配置"
echo "   - 选择「使用长连接接收事件」"
echo "   - 订阅事件：im.message.receive_v1"
echo ""
echo "3. 在飞书中测试机器人"
echo ""
echo -e "${YELLOW}📖 详细步骤：${NC}docs/05-gateway-setup.md"
echo ""
