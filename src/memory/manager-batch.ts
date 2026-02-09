import type { DatabaseSync } from "node:sqlite";
import type { SessionFileEntry } from "./session-files.js";
import type { MemorySource } from "./types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { runGeminiEmbeddingBatches, type GeminiBatchRequest } from "./batch-gemini.js";
import {
  OPENAI_BATCH_ENDPOINT,
  type OpenAiBatchRequest,
  runOpenAiEmbeddingBatches,
} from "./batch-openai.js";
import {
  type EmbeddingProvider,
  type GeminiEmbeddingClient,
  type OpenAiEmbeddingClient,
} from "./embeddings.js";
import { type MemoryChunk, type MemoryFileEntry, hashText } from "./internal.js";
import { loadEmbeddingCache, upsertEmbeddingCache } from "./manager-embedding-cache.js";

const log = createSubsystemLogger("memory");

export const EMBEDDING_BATCH_MAX_TOKENS = 8000;
export const EMBEDDING_APPROX_CHARS_PER_TOKEN = 1;
export const EMBEDDING_INDEX_CONCURRENCY = 4;
export const EMBEDDING_RETRY_MAX_ATTEMPTS = 3;
export const EMBEDDING_RETRY_BASE_DELAY_MS = 500;
export const EMBEDDING_RETRY_MAX_DELAY_MS = 8000;
export const BATCH_FAILURE_LIMIT = 2;
export const EMBEDDING_QUERY_TIMEOUT_REMOTE_MS = 60_000;
export const EMBEDDING_QUERY_TIMEOUT_LOCAL_MS = 5 * 60_000;
export const EMBEDDING_BATCH_TIMEOUT_REMOTE_MS = 2 * 60_000;
export const EMBEDDING_BATCH_TIMEOUT_LOCAL_MS = 10 * 60_000;

export type BatchConfig = {
  enabled: boolean;
  wait: boolean;
  concurrency: number;
  pollIntervalMs: number;
  timeoutMs: number;
};

export type EmbeddingBatchContext = {
  agentId: string;
  db: DatabaseSync;
  provider: EmbeddingProvider;
  providerKey: string;
  openAi?: OpenAiEmbeddingClient;
  gemini?: GeminiEmbeddingClient;
  cache: {
    enabled: boolean;
    maxEntries: number;
  };
  batchConfig: BatchConfig;
};

export class EmbeddingBatchManager {
  private _batchFailureCount = 0;
  public get batchFailureCount(): number {
    return this._batchFailureCount;
  }
  private batchFailureLock: Promise<void> = Promise.resolve();
  public batchFailureLastError?: string;
  public batchFailureLastProvider?: string;

  async embedChunksInBatches(
    chunks: MemoryChunk[],
    entry: MemoryFileEntry | SessionFileEntry | undefined,
    source: MemorySource | undefined,
    ctx: EmbeddingBatchContext,
  ): Promise<number[][]> {
    if (chunks.length === 0) {
      return [];
    }
    if (ctx.provider.id === "openai" && ctx.openAi) {
      return this.embedChunksWithOpenAiBatch(chunks, entry!, source!, ctx);
    }
    if (ctx.provider.id === "gemini" && ctx.gemini) {
      return this.embedChunksWithGeminiBatch(chunks, entry!, source!, ctx);
    }
    return this.embedGenericBatches(chunks, ctx);
  }

  private async embedGenericBatches(
    chunks: MemoryChunk[],
    ctx: EmbeddingBatchContext,
  ): Promise<number[][]> {
    const cached = this.loadCache(
      chunks.map((c) => c.hash),
      ctx,
    );
    const embeddings: number[][] = Array.from({ length: chunks.length }, () => []);
    const missing: Array<{ index: number; chunk: MemoryChunk }> = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const hit = chunk?.hash ? cached.get(chunk.hash) : undefined;
      if (hit && hit.length > 0) {
        embeddings[i] = hit;
      } else if (chunk) {
        missing.push({ index: i, chunk });
      }
    }

    if (missing.length === 0) {
      return embeddings;
    }

    const missingChunks = missing.map((m) => m.chunk);
    const batches = this.buildEmbeddingBatches(missingChunks);
    const toCache: Array<{ hash: string; embedding: number[] }> = [];
    let cursor = 0;

    for (const batch of batches) {
      const batchEmbeddings = await this.embedBatchWithRetry(
        batch.map((chunk) => chunk.text),
        ctx,
      );
      for (let i = 0; i < batch.length; i += 1) {
        const item = missing[cursor + i];
        const embedding = batchEmbeddings[i] ?? [];
        if (item) {
          embeddings[item.index] = embedding;
          toCache.push({ hash: item.chunk.hash, embedding });
        }
      }
      cursor += batch.length;
    }
    this.upsertCache(toCache, ctx);
    return embeddings;
  }

  private async embedChunksWithOpenAiBatch(
    chunks: MemoryChunk[],
    entry: MemoryFileEntry | SessionFileEntry,
    source: MemorySource,
    ctx: EmbeddingBatchContext,
  ): Promise<number[][]> {
    const openAi = ctx.openAi;
    if (!openAi) {
      return this.embedGenericBatches(chunks, ctx);
    }
    if (chunks.length === 0) {
      return [];
    }

    const cached = this.loadCache(
      chunks.map((c) => c.hash),
      ctx,
    );
    const embeddings: number[][] = Array.from({ length: chunks.length }, () => []);
    const missing: Array<{ index: number; chunk: MemoryChunk }> = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const hit = chunk?.hash ? cached.get(chunk.hash) : undefined;
      if (hit && hit.length > 0) {
        embeddings[i] = hit;
      } else if (chunk) {
        missing.push({ index: i, chunk });
      }
    }

    if (missing.length === 0) {
      return embeddings;
    }

    const requests: OpenAiBatchRequest[] = [];
    const mapping = new Map<string, { index: number; hash: string }>();
    for (const item of missing) {
      const chunk = item.chunk;
      const customId = hashText(
        `${source}:${entry.path}:${chunk.startLine}:${chunk.endLine}:${chunk.hash}:${item.index}`,
      );
      mapping.set(customId, { index: item.index, hash: chunk.hash });
      requests.push({
        custom_id: customId,
        method: "POST",
        url: OPENAI_BATCH_ENDPOINT,
        body: {
          model: ctx.openAi?.model ?? ctx.provider.model,
          input: chunk.text,
        },
      });
    }

    const batchResult = await this.runBatchWithFallback({
      provider: "openai",
      ctx,
      run: async () =>
        await runOpenAiEmbeddingBatches({
          openAi,
          agentId: ctx.agentId,
          requests,
          wait: ctx.batchConfig.wait,
          concurrency: ctx.batchConfig.concurrency,
          pollIntervalMs: ctx.batchConfig.pollIntervalMs,
          timeoutMs: ctx.batchConfig.timeoutMs,
          debug: (message, data) => log.debug(message, { ...data, source, chunks: chunks.length }),
        }),
      fallback: async () => await this.embedGenericBatches(chunks, ctx),
    });

    if (Array.isArray(batchResult)) {
      return batchResult;
    }
    const byCustomId = batchResult;

    const toCache: Array<{ hash: string; embedding: number[] }> = [];
    for (const [customId, embedding] of byCustomId.entries()) {
      const mapped = mapping.get(customId);
      if (!mapped) {
        continue;
      }
      embeddings[mapped.index] = embedding;
      toCache.push({ hash: mapped.hash, embedding });
    }
    this.upsertCache(toCache, ctx);
    return embeddings;
  }

  private async embedChunksWithGeminiBatch(
    chunks: MemoryChunk[],
    entry: MemoryFileEntry | SessionFileEntry,
    source: MemorySource,
    ctx: EmbeddingBatchContext,
  ): Promise<number[][]> {
    const gemini = ctx.gemini;
    if (!gemini) {
      return this.embedGenericBatches(chunks, ctx);
    }
    if (chunks.length === 0) {
      return [];
    }
    const cached = this.loadCache(
      chunks.map((c) => c.hash),
      ctx,
    );
    const embeddings: number[][] = Array.from({ length: chunks.length }, () => []);
    const missing: Array<{ index: number; chunk: MemoryChunk }> = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const hit = chunk?.hash ? cached.get(chunk.hash) : undefined;
      if (hit && hit.length > 0) {
        embeddings[i] = hit;
      } else if (chunk) {
        missing.push({ index: i, chunk });
      }
    }

    if (missing.length === 0) {
      return embeddings;
    }

    const requests: GeminiBatchRequest[] = [];
    const mapping = new Map<string, { index: number; hash: string }>();
    for (const item of missing) {
      const chunk = item.chunk;
      const customId = hashText(
        `${source}:${entry.path}:${chunk.startLine}:${chunk.endLine}:${chunk.hash}:${item.index}`,
      );
      mapping.set(customId, { index: item.index, hash: chunk.hash });
      requests.push({
        custom_id: customId,
        content: { parts: [{ text: chunk.text }] },
        taskType: "RETRIEVAL_DOCUMENT",
      });
    }

    const batchResult = await this.runBatchWithFallback({
      provider: "gemini",
      ctx,
      run: async () =>
        await runGeminiEmbeddingBatches({
          gemini,
          agentId: ctx.agentId,
          requests,
          wait: ctx.batchConfig.wait,
          concurrency: ctx.batchConfig.concurrency,
          pollIntervalMs: ctx.batchConfig.pollIntervalMs,
          timeoutMs: ctx.batchConfig.timeoutMs,
          debug: (message, data) => log.debug(message, { ...data, source, chunks: chunks.length }),
        }),
      fallback: async () => await this.embedGenericBatches(chunks, ctx),
    });

    if (Array.isArray(batchResult)) {
      return batchResult;
    }
    const byCustomId = batchResult;

    const toCache: Array<{ hash: string; embedding: number[] }> = [];
    for (const [customId, embedding] of byCustomId.entries()) {
      const mapped = mapping.get(customId);
      if (!mapped) {
        continue;
      }
      embeddings[mapped.index] = embedding;
      toCache.push({ hash: mapped.hash, embedding });
    }
    this.upsertCache(toCache, ctx);
    return embeddings;
  }

  public async embedBatchWithRetry(
    texts: string[],
    ctx: EmbeddingBatchContext,
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    let attempt = 0;
    let delayMs = EMBEDDING_RETRY_BASE_DELAY_MS;
    while (true) {
      try {
        const timeoutMs = this.resolveEmbeddingTimeout("batch", ctx);
        log.debug("memory embeddings: batch start", {
          provider: ctx.provider.id,
          items: texts.length,
          timeoutMs,
        });
        return await this.withTimeout(
          ctx.provider.embedBatch(texts),
          timeoutMs,
          `memory embeddings batch timed out after ${Math.round(timeoutMs / 1000)}s`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!this.isRetryableEmbeddingError(message) || attempt >= EMBEDDING_RETRY_MAX_ATTEMPTS) {
          throw err;
        }
        const waitMs = Math.min(
          EMBEDDING_RETRY_MAX_DELAY_MS,
          Math.round(delayMs * (1 + Math.random() * 0.2)),
        );
        log.warn(`memory embeddings rate limited; retrying in ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        delayMs *= 2;
        attempt += 1;
      }
    }
  }

  private buildEmbeddingBatches(chunks: MemoryChunk[]): MemoryChunk[][] {
    const batches: MemoryChunk[][] = [];
    let current: MemoryChunk[] = [];
    let currentTokens = 0;

    for (const chunk of chunks) {
      const estimate = Math.ceil(chunk.text.length / EMBEDDING_APPROX_CHARS_PER_TOKEN);
      const wouldExceed =
        current.length > 0 && currentTokens + estimate > EMBEDDING_BATCH_MAX_TOKENS;
      if (wouldExceed) {
        batches.push(current);
        current = [];
        currentTokens = 0;
      }
      if (current.length === 0 && estimate > EMBEDDING_BATCH_MAX_TOKENS) {
        batches.push([chunk]);
        continue;
      }
      current.push(chunk);
      currentTokens += estimate;
    }

    if (current.length > 0) {
      batches.push(current);
    }
    return batches;
  }

  private async runBatchWithFallback<T>(params: {
    provider: string;
    ctx: EmbeddingBatchContext;
    run: () => Promise<T>;
    fallback: () => Promise<number[][]>;
  }): Promise<T | number[][]> {
    const { ctx } = params;
    if (!ctx.batchConfig.enabled) {
      return await params.fallback();
    }
    try {
      const result = await this.runBatchWithTimeoutRetry({
        provider: params.provider,
        run: params.run,
      });
      await this.resetBatchFailureCount();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = (err as { batchAttempts?: number }).batchAttempts ?? 1;
      const forceDisable = /asyncBatchEmbedContent not available/i.test(message);
      const failure = await this.recordBatchFailure({
        provider: params.provider,
        message,
        attempts,
        forceDisable,
        ctx,
      });
      log.warn(
        `memory embeddings: ${params.provider} batch failed (${failure.count}/${BATCH_FAILURE_LIMIT}); ` +
          `${failure.disabled ? "disabling batch; " : "keeping batch enabled; "}` +
          `falling back to non-batch`,
        { error: message },
      );
      return await params.fallback();
    }
  }

  private async runBatchWithTimeoutRetry<T>(params: {
    provider: string;
    run: () => Promise<T>;
  }): Promise<T> {
    try {
      return await params.run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/timed out|timeout/i.test(message)) {
        log.warn(`memory embeddings: ${params.provider} batch timed out; retrying once`);
        try {
          return await params.run();
        } catch (retryErr) {
          (retryErr as { batchAttempts?: number }).batchAttempts = 2;
          throw retryErr;
        }
      }
      throw err;
    }
  }

  public async recordBatchFailure(params: {
    provider: string;
    message: string;
    attempts?: number;
    forceDisable?: boolean;
    ctx: EmbeddingBatchContext;
  }): Promise<{ disabled: boolean; count: number }> {
    return await this.withBatchFailureLock(async () => {
      // If config says disabled already, return current count
      if (!params.ctx.batchConfig.enabled) {
        return { disabled: true, count: this._batchFailureCount };
      }
      const increment = params.forceDisable
        ? BATCH_FAILURE_LIMIT
        : Math.max(1, params.attempts ?? 1);
      this._batchFailureCount += increment;
      this.batchFailureLastError = params.message;
      this.batchFailureLastProvider = params.provider;
      const disabled = params.forceDisable || this._batchFailureCount >= BATCH_FAILURE_LIMIT;
      if (disabled) {
        params.ctx.batchConfig.enabled = false;
      }
      return { disabled, count: this._batchFailureCount };
    });
  }

  private async withBatchFailureLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const wait = this.batchFailureLock;
    this.batchFailureLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await wait;
    try {
      return await fn();
    } finally {
      release!();
    }
  }

  public async resetBatchFailureCount(): Promise<void> {
    await this.withBatchFailureLock(async () => {
      if (this._batchFailureCount > 0) {
        log.debug("memory embeddings: batch recovered; resetting failure count");
      }
      this._batchFailureCount = 0;
      this.batchFailureLastError = undefined;
      this.batchFailureLastProvider = undefined;
    });
  }

  private isRetryableEmbeddingError(message: string): boolean {
    return /(rate[_ ]limit|too many requests|429|resource has been exhausted|5\d\d|cloudflare)/i.test(
      message,
    );
  }

  private resolveEmbeddingTimeout(kind: "query" | "batch", ctx: EmbeddingBatchContext): number {
    const isLocal = ctx.provider.id === "local";
    if (kind === "query") {
      return isLocal ? EMBEDDING_QUERY_TIMEOUT_LOCAL_MS : EMBEDDING_QUERY_TIMEOUT_REMOTE_MS;
    }
    return isLocal ? EMBEDDING_BATCH_TIMEOUT_LOCAL_MS : EMBEDDING_BATCH_TIMEOUT_REMOTE_MS;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return await promise;
    }
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    try {
      return (await Promise.race([promise, timeoutPromise])) as T;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private loadCache(hashes: string[], ctx: EmbeddingBatchContext): Map<string, number[]> {
    return loadEmbeddingCache(
      {
        db: ctx.db,
        cache: ctx.cache,
        provider: ctx.provider,
        providerKey: ctx.providerKey,
      },
      hashes,
    );
  }

  private upsertCache(
    entries: Array<{ hash: string; embedding: number[] }>,
    ctx: EmbeddingBatchContext,
  ): void {
    if (!ctx.cache.enabled) {
      return;
    }
    upsertEmbeddingCache(
      {
        db: ctx.db,
        cache: ctx.cache,
        provider: ctx.provider,
        providerKey: ctx.providerKey,
      },
      entries,
    );
  }
}
