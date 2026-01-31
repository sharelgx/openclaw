# 企业微信插件 (WeCom Plugin)

OpenClaw 企业微信频道插件，支持：

- 📨 消息收发（通过 HTTP 回调）
- 📊 智能表格读取
- 📄 智能文档读取
- 👥 客户信息查询

## 前置要求

1. **企业微信管理员权限** - 需要创建自建应用
2. **公网域名 + HTTPS** - 企业微信回调必须使用 HTTPS
3. **已配置的回调服务器** - 部署在你的服务器上

## 配置步骤

### 1. 创建企业微信自建应用

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)
2. 进入 **应用管理** → **自建** → **创建应用**
3. 填写应用信息，创建完成后记录：
   - **AgentId** - 应用 ID
   - **Secret** - 应用密钥

### 2. 获取企业 ID

在管理后台 **我的企业** 页面底部找到 **企业 ID (CorpID)**

### 3. 配置接收消息

1. 在应用详情页，找到 **接收消息** → **设置 API 接收**
2. 填写：
   - **URL**: `https://你的域名/wecom/callback`
   - **Token**: 自定义（如 `openclaw_wecom_token`）
   - **EncodingAESKey**: 点击随机生成
3. 保存这些信息

### 4. 配置 OpenClaw

在 OpenClaw 配置文件中添加：

```json
{
  "channels": {
    "wecom": {
      "enabled": true,
      "corpId": "你的企业ID",
      "corpSecret": "你的应用Secret",
      "agentId": "你的AgentId",
      "token": "你设置的Token",
      "encodingAESKey": "你的EncodingAESKey",
      "callbackPort": 3003,
      "dmPolicy": "pairing",
      "allowFrom": []
    }
  }
}
```

### 5. 部署回调服务

确保你的服务器上：
- Nginx 已配置反向代理到端口 3003
- HTTPS 证书有效

## API 权限

根据你需要的功能，在应用权限中开启：

| 功能 | 所需权限 |
|------|---------|
| 消息收发 | 发送应用消息 |
| 智能表格 | 文档读取 |
| 智能文档 | 文档读取 |
| 客户信息 | 客户联系-客户 |

## AI 工具

插件注册了以下 AI 工具：

- `read_wecom_sheet` - 读取智能表格数据
- `read_wecom_doc` - 读取文档内容
- `get_wecom_customers` - 获取客户列表
- `get_wecom_customer_detail` - 获取客户详情

## 注意事项

1. **消息时效** - 企业微信要求 5 秒内响应回调，插件会先返回空响应再异步处理
2. **消息长度** - 文本消息限制 2048 字符，超长会自动分片
3. **流式响应** - 企业微信不支持流式消息，会等待完整响应后发送

## 故障排查

### 回调验证失败

检查：
- Token 和 EncodingAESKey 是否正确
- 时间戳是否准确（服务器时间同步）
- CorpID 是否匹配

### 消息发送失败

检查：
- access_token 是否过期（自动刷新）
- 用户是否在应用可见范围内
- AgentId 是否正确

### 读取文档失败

检查：
- 应用是否有文档读取权限
- 文档 ID 是否正确
- 文档是否对应用可见
