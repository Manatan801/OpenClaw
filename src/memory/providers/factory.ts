import type { EmbeddingProviderOptions, EmbeddingProviderResult } from "./interfaces.js";
import { createGeminiEmbeddingProvider } from "./gemini.js";
import {
  canAutoSelectLocal,
  createLocalEmbeddingProvider,
  formatLocalSetupError,
} from "./local.js";
import { createOpenAiEmbeddingProvider } from "./openai.js";

function isMissingApiKeyError(err: unknown): boolean {
  const message = formatError(err);
  return message.includes("No API key found for provider");
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export async function createEmbeddingProvider(
  options: EmbeddingProviderOptions,
): Promise<EmbeddingProviderResult> {
  const requestedProvider = options.provider;
  const fallback = options.fallback;

  const createProvider = async (id: "openai" | "local" | "gemini") => {
    if (id === "local") {
      const provider = await createLocalEmbeddingProvider(options);
      return { provider };
    }
    if (id === "gemini") {
      const { provider, client } = await createGeminiEmbeddingProvider(options);
      return { provider, gemini: client };
    }
    const { provider, client } = await createOpenAiEmbeddingProvider(options);
    return { provider, openAi: client };
  };

  const formatPrimaryError = (err: unknown, provider: "openai" | "local" | "gemini") =>
    provider === "local" ? formatLocalSetupError(err) : formatError(err);

  if (requestedProvider === "auto") {
    const missingKeyErrors: string[] = [];
    let localError: string | null = null;

    if (canAutoSelectLocal(options)) {
      try {
        const local = await createProvider("local");
        return { ...local, requestedProvider };
      } catch (err) {
        localError = formatLocalSetupError(err);
      }
    }

    for (const provider of ["openai", "gemini"] as const) {
      try {
        const result = await createProvider(provider);
        return { ...result, requestedProvider };
      } catch (err) {
        const message = formatPrimaryError(err, provider);
        if (isMissingApiKeyError(err)) {
          missingKeyErrors.push(message);
          continue;
        }
        throw new Error(message, { cause: err });
      }
    }

    const details = [...missingKeyErrors, localError].filter(Boolean) as string[];
    if (details.length > 0) {
      throw new Error(details.join("\n\n"));
    }
    throw new Error("No embeddings provider available.");
  }

  try {
    const primary = await createProvider(requestedProvider);
    return { ...primary, requestedProvider };
  } catch (primaryErr) {
    const reason = formatPrimaryError(primaryErr, requestedProvider);
    if (fallback && fallback !== "none" && fallback !== requestedProvider) {
      try {
        const fallbackResult = await createProvider(fallback);
        return {
          ...fallbackResult,
          requestedProvider,
          fallbackFrom: requestedProvider,
          fallbackReason: reason,
        };
      } catch (fallbackErr) {
        // oxlint-disable-next-line preserve-caught-error
        throw new Error(
          `${reason}\n\nFallback to ${fallback} failed: ${formatError(fallbackErr)}`,
          { cause: fallbackErr },
        );
      }
    }
    throw new Error(reason, { cause: primaryErr });
  }
}
