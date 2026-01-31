import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setFeishuRuntime(rt: PluginRuntime) {
  runtime = rt;
}

export function getFeishuRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("飞书 runtime 未初始化");
  }
  return runtime;
}
