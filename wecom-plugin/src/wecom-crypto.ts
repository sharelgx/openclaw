/**
 * 企业微信消息加解密
 * 参考: https://developer.work.weixin.qq.com/document/path/90968
 */
import crypto from "crypto";

export interface WecomCryptoConfig {
  token: string;
  encodingAESKey: string;
  corpId: string;
}

/**
 * 企业微信消息加解密类
 */
export class WecomCrypto {
  private token: string;
  private aesKey: Buffer;
  private corpId: string;

  constructor(config: WecomCryptoConfig) {
    this.token = config.token;
    this.corpId = config.corpId;
    // EncodingAESKey 是 Base64 编码的 AES 密钥
    this.aesKey = Buffer.from(config.encodingAESKey + "=", "base64");
  }

  /**
   * 验证签名
   */
  verifySignature(signature: string, timestamp: string, nonce: string, echostr: string = ""): boolean {
    const items = [this.token, timestamp, nonce, echostr].filter(Boolean).sort();
    const str = items.join("");
    const hash = crypto.createHash("sha1").update(str).digest("hex");
    return hash === signature;
  }

  /**
   * 生成签名
   */
  generateSignature(timestamp: string, nonce: string, encrypt: string): string {
    const items = [this.token, timestamp, nonce, encrypt].sort();
    const str = items.join("");
    return crypto.createHash("sha1").update(str).digest("hex");
  }

  /**
   * 解密消息
   */
  decrypt(encrypted: string): string {
    const decipher = crypto.createDecipheriv("aes-256-cbc", this.aesKey, this.aesKey.subarray(0, 16));
    decipher.setAutoPadding(false);
    
    let decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]);

    // 去除 PKCS7 填充
    const padLength = decrypted[decrypted.length - 1];
    decrypted = decrypted.subarray(0, decrypted.length - padLength);

    // 消息格式: random(16) + msgLen(4) + msg + corpId
    const msgLen = decrypted.readUInt32BE(16);
    const message = decrypted.subarray(20, 20 + msgLen).toString("utf8");
    const receivedCorpId = decrypted.subarray(20 + msgLen).toString("utf8");

    if (receivedCorpId !== this.corpId) {
      throw new Error(`CorpId 不匹配: ${receivedCorpId} !== ${this.corpId}`);
    }

    return message;
  }

  /**
   * 加密消息
   */
  encrypt(message: string): string {
    // 生成 16 字节随机数
    const random = crypto.randomBytes(16);
    const msgBuffer = Buffer.from(message, "utf8");
    const msgLen = Buffer.alloc(4);
    msgLen.writeUInt32BE(msgBuffer.length, 0);
    const corpIdBuffer = Buffer.from(this.corpId, "utf8");

    // 拼接: random(16) + msgLen(4) + msg + corpId
    let data = Buffer.concat([random, msgLen, msgBuffer, corpIdBuffer]);

    // PKCS7 填充
    const blockSize = 32;
    const padLength = blockSize - (data.length % blockSize);
    const padding = Buffer.alloc(padLength, padLength);
    data = Buffer.concat([data, padding]);

    // AES 加密
    const cipher = crypto.createCipheriv("aes-256-cbc", this.aesKey, this.aesKey.subarray(0, 16));
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

    return encrypted.toString("base64");
  }

  /**
   * 解密 echostr（用于验证 URL）
   */
  decryptEchoStr(echostr: string): string {
    return this.decrypt(echostr);
  }
}

/**
 * 生成随机字符串
 */
export function generateNonce(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * 获取当前时间戳
 */
export function getTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}
