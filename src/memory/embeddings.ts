export {
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  createGeminiEmbeddingProvider,
  resolveGeminiEmbeddingClient,
} from "./providers/gemini.js";
export type { GeminiEmbeddingClient } from "./providers/gemini.js";

export { createEmbeddingProvider } from "./providers/factory.js";

export type {
  EmbeddingProvider,
  EmbeddingProviderOptions,
  EmbeddingProviderResult,
} from "./providers/interfaces.js";

export {
  canAutoSelectLocal,
  createLocalEmbeddingProvider,
  formatLocalSetupError,
} from "./providers/local.js";

export {
  DEFAULT_OPENAI_EMBEDDING_MODEL,
  createOpenAiEmbeddingProvider,
  normalizeOpenAiModel,
  resolveOpenAiEmbeddingClient,
} from "./providers/openai.js";
export type { OpenAiEmbeddingClient } from "./providers/openai.js";
