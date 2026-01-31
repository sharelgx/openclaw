# 04. 安装飞书插件

本文档介绍如何在 Clawdbot 中安装飞书插件。

## 前置要求

- ✅ 已安装 Clawdbot
- ✅ 已配置模型提供商
- ✅ 已在飞书开放平台创建应用

## 方法一：使用自动化脚本（推荐）

### 1. 使用快速安装脚本

如果还未运行过快速安装：

```bash
cd feishu-clawdbot-guide
./quick-start.sh
```

这会自动：
- 安装 Clawdbot（如果未安装）
- 复制插件文件
- 安装依赖

### 2. 使用插件安装脚本

如果只需要安装或更新插件：

```bash
./install-plugin.sh
```

## 方法二：手动安装

### 1. 创建插件目录

```bash
mkdir -p ~/.clawdbot/extensions/feishu
```

### 2. 复制插件文件

```bash
cd feishu-clawdbot-guide
cp -r feishu-plugin/* ~/.clawdbot/extensions/feishu/
```

### 3. 安装依赖

```bash
cd ~/.clawdbot/extensions/feishu
npm install
```

### 4. 启用插件

编辑 `~/.clawdbot/clawdbot.json`，添加：

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

### 5. 配置飞书频道

在同一文件中添加：

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

将 `appId` 和 `appSecret` 替换为你在飞书开放平台获取的值。

## 配置说明

### dmPolicy（私聊策略）

- **`pairing`**（推荐）：需要配对授权
  - 首次使用时机器人会发送配对码
  - 需要运行 `clawdbot pairing approve feishu <配对码>` 批准
  - 最安全的方式

- **`allowlist`**：白名单模式
  - 只有 `allowFrom` 列表中的用户可以使用
  - 需要手动添加用户 ID
  - 适合固定用户群

- **`open`**：开放模式
  - 所有人都可以使用
  - ⚠️ 不推荐，可能导致滥用

### allowFrom（用户白名单）

用户 ID 列表，格式：

```json
"allowFrom": [
  "ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
]
```

**如何获取用户 ID：**
- 在 Gateway 日志中查看
- 或运行 `clawdbot pairing list` 查看配对请求

## 验证安装

### 1. 检查插件文件

```bash
ls ~/.clawdbot/extensions/feishu/
```

应该看到：
```
clawdbot.plugin.json
index.ts
node_modules/
package.json
src/
```

### 2. 验证插件注册

```bash
clawdbot doctor
```

应该显示飞书插件已加载。

### 3. 启动 Gateway 测试

```bash
clawdbot gateway --verbose
```

应该看到：

```
[gateway] 飞书插件已加载（长连接模式，无需 webhook 地址）
[feishu] 启动长连接 (account=default)
[feishu] 长连接已连接
```

## 更新插件

### 1. 拉取最新代码

```bash
cd feishu-clawdbot-guide
git pull
```

### 2. 重新安装

```bash
./install-plugin.sh
```

### 3. 重启 Gateway

```bash
clawdbot gateway stop
clawdbot gateway --verbose
```

## 卸载插件

如果需要卸载插件：

```bash
# 备份配置
cp ~/.clawdbot/clawdbot.json ~/.clawdbot/clawdbot.json.backup

# 删除插件目录
rm -rf ~/.clawdbot/extensions/feishu

# 编辑配置文件，移除飞书相关配置
nano ~/.clawdbot/clawdbot.json
```

## 常见问题

### Q: 插件安装后 Gateway 启动失败

**A:** 可能原因：
1. **依赖未安装** → 运行 `cd ~/.clawdbot/extensions/feishu && npm install`
2. **配置文件错误** → 运行 `clawdbot doctor` 检查
3. **TypeScript 编译错误** → 查看 Gateway 日志

### Q: 提示找不到插件

**A:** 检查：
1. 插件目录是否存在：`ls ~/.clawdbot/extensions/feishu`
2. 配置文件中是否启用：`cat ~/.clawdbot/clawdbot.json | grep feishu`
3. 插件清单文件是否存在：`cat ~/.clawdbot/extensions/feishu/clawdbot.plugin.json`

### Q: 如何查看插件版本？

**A:** 查看 `package.json`：

```bash
cat ~/.clawdbot/extensions/feishu/package.json | grep version
```

### Q: 插件日志在哪里？

**A:** Gateway 日志包含插件日志：

```bash
tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log | grep feishu
```

## 下一步

插件安装完成后，继续：

- [05. 启动和配置 Gateway](05-gateway-setup.md) - 启动并测试完整流程
- [返回主文档](../README.md)

## 相关资源

- [插件源代码](../feishu-plugin/)
- [配置文件示例](../config-examples/)
- [故障排查](06-troubleshooting.md)
