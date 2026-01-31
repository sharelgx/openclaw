#!/bin/bash

# 飞书 Clawdbot 一键安装脚本
# 自动安装 Clawdbot 和飞书插件

set -e

echo "================================================"
echo "🦞 飞书 Clawdbot 一键安装脚本"
echo "================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Linux"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        echo "Windows"
    else
        echo "Unknown"
    fi
}

OS=$(detect_os)
echo -e "${BLUE}检测到操作系统: $OS${NC}"
echo ""

# 检查 Clawdbot 是否已安装
if command -v clawdbot &> /dev/null; then
    CLAWDBOT_VERSION=$(clawdbot --version 2>&1 | head -n 1 || echo "unknown")
    echo -e "${GREEN}✓ Clawdbot 已安装: $CLAWDBOT_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ Clawdbot 未安装${NC}"
    echo ""
    echo "正在安装 Clawdbot..."
    echo ""
    
    # 使用官方安装脚本
    if [[ "$OS" == "Windows" ]]; then
        echo -e "${RED}请在 Windows 上手动运行以下命令：${NC}"
        echo "PowerShell:"
        echo '  irm https://clawd.bot/install.ps1 | iex'
        echo ""
        echo "或 CMD:"
        echo '  curl -fsSL https://clawd.bot/install.bat | cmd'
        exit 1
    else
        curl -fsSL https://clawd.bot/install.sh | bash
        
        # 重新加载环境变量
        export PATH="$HOME/.clawdbot/bin:$PATH"
        
        if command -v clawdbot &> /dev/null; then
            echo -e "${GREEN}✓ Clawdbot 安装成功！${NC}"
        else
            echo -e "${RED}✗ Clawdbot 安装失败，请手动安装${NC}"
            echo "访问：https://clawd.bot"
            exit 1
        fi
    fi
fi

echo ""
echo "================================================"
echo "📦 安装飞书插件"
echo "================================================"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 检查插件目录是否存在
if [ ! -d "$SCRIPT_DIR/feishu-plugin" ]; then
    echo -e "${RED}✗ 错误：找不到插件目录 feishu-plugin/${NC}"
    echo "请确保在仓库根目录运行此脚本"
    exit 1
fi

# 目标目录
TARGET_DIR="$HOME/.clawdbot/extensions/feishu"

# 创建目标目录
mkdir -p "$TARGET_DIR"

# 复制插件文件
echo "复制插件文件到 $TARGET_DIR ..."
cp -r "$SCRIPT_DIR/feishu-plugin/"* "$TARGET_DIR/"

echo -e "${GREEN}✓ 插件文件已复制${NC}"
echo ""

# 安装依赖
echo "安装插件依赖..."
cd "$TARGET_DIR"

if command -v npm &> /dev/null; then
    npm install
    echo -e "${GREEN}✓ 依赖安装成功${NC}"
else
    echo -e "${RED}✗ 未找到 npm，请先安装 Node.js${NC}"
    exit 1
fi

echo ""
echo "================================================"
echo "✅ 安装完成！"
echo "================================================"
echo ""
echo -e "${BLUE}下一步：${NC}"
echo ""
echo "1. 运行配置向导（交互式配置）："
echo -e "   ${GREEN}./configure.sh${NC}"
echo ""
echo "2. 或手动编辑配置文件："
echo -e "   ${GREEN}nano ~/.clawdbot/clawdbot.json${NC}"
echo ""
echo "3. 启动 Gateway："
echo -e "   ${GREEN}clawdbot gateway --verbose${NC}"
echo ""
echo -e "${YELLOW}📖 完整文档：${NC}docs/ 目录"
echo ""
