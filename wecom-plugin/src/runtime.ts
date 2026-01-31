/**
 * 企业微信运行时上下文
 */
import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setWecomRuntime(r: PluginRuntime) {
  runtime = r;
}

export function getWecomRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("企业微信运行时未初始化");
  }
  return runtime;
}
