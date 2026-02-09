import type { DatabaseSync } from "node:sqlite";
import { parseEmbedding } from "./internal.js";

export const EMBEDDING_CACHE_TABLE = "embedding_cache";

/**
 * Load cached embeddings for a set of content hashes from the embedding cache table.
 * Returns a map of hash -> embedding for entries that exist in the cache.
 */
export function loadEmbeddingCache(
  params: {
    db: DatabaseSync;
    cache: { enabled: boolean };
    provider: { id: string; model: string };
    providerKey: string;
  },
  hashes: string[],
): Map<string, number[]> {
  if (!params.cache.enabled) {
    return new Map();
  }
  if (hashes.length === 0) {
    return new Map();
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const hash of hashes) {
    if (!hash) {
      continue;
    }
    if (seen.has(hash)) {
      continue;
    }
    seen.add(hash);
    unique.push(hash);
  }
  if (unique.length === 0) {
    return new Map();
  }

  const out = new Map<string, number[]>();
  const baseParams = [params.provider.id, params.provider.model, params.providerKey];
  const batchSize = 400;
  for (let start = 0; start < unique.length; start += batchSize) {
    const batch = unique.slice(start, start + batchSize);
    const placeholders = batch.map(() => "?").join(", ");
    const rows = params.db
      .prepare(
        `SELECT hash, embedding FROM ${EMBEDDING_CACHE_TABLE}\n` +
          ` WHERE provider = ? AND model = ? AND provider_key = ? AND hash IN (${placeholders})`,
      )
      .all(...baseParams, ...batch) as Array<{ hash: string; embedding: string }>;
    for (const row of rows) {
      out.set(row.hash, parseEmbedding(row.embedding));
    }
  }
  return out;
}

/**
 * Insert or update embedding cache entries for the current provider/model/key combination.
 */
export function upsertEmbeddingCache(
  params: {
    db: DatabaseSync;
    cache: { enabled: boolean };
    provider: { id: string; model: string };
    providerKey: string;
  },
  entries: Array<{ hash: string; embedding: number[] }>,
): void {
  if (!params.cache.enabled) {
    return;
  }
  if (entries.length === 0) {
    return;
  }
  const now = Date.now();
  const stmt = params.db.prepare(
    `INSERT INTO ${EMBEDDING_CACHE_TABLE} (provider, model, provider_key, hash, embedding, dims, updated_at)\n` +
      ` VALUES (?, ?, ?, ?, ?, ?, ?)\n` +
      ` ON CONFLICT(provider, model, provider_key, hash) DO UPDATE SET\n` +
      `   embedding=excluded.embedding,\n` +
      `   dims=excluded.dims,\n` +
      `   updated_at=excluded.updated_at`,
  );
  for (const entry of entries) {
    const embedding = entry.embedding ?? [];
    stmt.run(
      params.provider.id,
      params.provider.model,
      params.providerKey,
      entry.hash,
      JSON.stringify(embedding),
      embedding.length,
      now,
    );
  }
}

/**
 * Remove oldest cache entries when the count exceeds the configured maximum.
 */
export function pruneEmbeddingCacheIfNeeded(params: {
  db: DatabaseSync;
  cache: { enabled: boolean; maxEntries?: number };
}): void {
  if (!params.cache.enabled) {
    return;
  }
  const max = params.cache.maxEntries;
  if (!max || max <= 0) {
    return;
  }
  const row = params.db.prepare(`SELECT COUNT(*) as c FROM ${EMBEDDING_CACHE_TABLE}`).get() as
    | { c: number }
    | undefined;
  const count = row?.c ?? 0;
  if (count <= max) {
    return;
  }
  const excess = count - max;
  params.db
    .prepare(
      `DELETE FROM ${EMBEDDING_CACHE_TABLE}\n` +
        ` WHERE rowid IN (\n` +
        `   SELECT rowid FROM ${EMBEDDING_CACHE_TABLE}\n` +
        `   ORDER BY updated_at ASC\n` +
        `   LIMIT ?\n` +
        ` )`,
    )
    .run(excess);
}
