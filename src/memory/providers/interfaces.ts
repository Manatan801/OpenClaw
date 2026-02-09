import type { OpenClawConfig } from "../../config/config.js";
import type { GeminiEmbeddingClient } from "./gemini.js";
import type { OpenAiEmbeddingClient } from "./openai.js";

export type EmbeddingProvider = {
  id: string;
  model: string;
  embedQuery: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
};

export type EmbeddingProviderResult = {
  provider: EmbeddingProvider;
  requestedProvider: "openai" | "local" | "gemini" | "auto";
  fallbackFrom?: "openai" | "local" | "gemini";
  fallbackReason?: string;
  openAi?: OpenAiEmbeddingClient;
  gemini?: GeminiEmbeddingClient;
};

export type EmbeddingProviderOptions = {
  config: OpenClawConfig;
  agentDir?: string;
  provider: "openai" | "local" | "gemini" | "auto";
  remote?: {
    baseUrl?: string;
    apiKey?: string;
    headers?: Record<string, string>;
  };
  model: string;
  fallback: "openai" | "gemini" | "local" | "none";
  local?: {
    modelPath?: string;
    modelCacheDir?: string;
  };
};
