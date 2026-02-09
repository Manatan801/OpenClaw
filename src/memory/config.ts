import type { OpenClawConfig } from "../config/config.js";
import type { MemoryBackend, MemoryCitationsMode } from "../config/types.memory.js";
import { resolveAgentWorkspaceDir } from "../agents/agent-scope.js";
import { resolveQmdConfig, type ResolvedQmdConfig } from "./config-qmd.js";

export type ResolvedMemoryBackendConfig = {
  backend: MemoryBackend;
  citations: MemoryCitationsMode;
  qmd?: ResolvedQmdConfig;
};

const DEFAULT_BACKEND: MemoryBackend = "builtin";
const DEFAULT_CITATIONS: MemoryCitationsMode = "auto";

export function resolveMemoryBackendConfig(params: {
  cfg: OpenClawConfig;
  agentId: string;
}): ResolvedMemoryBackendConfig {
  const backend = params.cfg.memory?.backend ?? DEFAULT_BACKEND;
  const citations = params.cfg.memory?.citations ?? DEFAULT_CITATIONS;
  if (backend !== "qmd") {
    return { backend: "builtin", citations };
  }

  const workspaceDir = resolveAgentWorkspaceDir(params.cfg, params.agentId);
  const qmd = resolveQmdConfig(params.cfg.memory?.qmd, workspaceDir);

  return {
    backend: "qmd",
    citations,
    qmd,
  };
}
