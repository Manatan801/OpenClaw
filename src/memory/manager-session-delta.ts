import fs from "node:fs/promises";
import path from "node:path";
import { resolveSessionTranscriptsDirForAgent } from "../config/sessions/paths.js";

export const SESSION_DIRTY_DEBOUNCE_MS = 5000;
export const SESSION_DELTA_READ_CHUNK_BYTES = 64 * 1024;

export type SessionDeltaState = {
  lastSize: number;
  pendingBytes: number;
  pendingMessages: number;
};

export type SessionDeltaThresholds = {
  deltaBytes: number;
  deltaMessages: number;
};

/**
 * Process a batch of pending session files: update deltas for each and check
 * whether any file crosses the configured byte/message thresholds.
 *
 * Returns the set of session files that crossed the threshold (and should be
 * marked dirty for the next sync).
 */
export async function processSessionDeltaBatch(params: {
  pendingFiles: string[];
  deltas: Map<string, SessionDeltaState>;
  thresholds: SessionDeltaThresholds | undefined;
}): Promise<{ dirtyFiles: string[]; shouldSync: boolean }> {
  const { pendingFiles, deltas, thresholds } = params;
  if (pendingFiles.length === 0) {
    return { dirtyFiles: [], shouldSync: false };
  }

  const dirtyFiles: string[] = [];
  let shouldSync = false;

  for (const sessionFile of pendingFiles) {
    const delta = await updateSessionDelta({
      sessionFile,
      deltas,
      thresholds,
    });
    if (!delta) {
      continue;
    }
    const bytesThreshold = delta.deltaBytes;
    const messagesThreshold = delta.deltaMessages;
    const bytesHit =
      bytesThreshold <= 0 ? delta.pendingBytes > 0 : delta.pendingBytes >= bytesThreshold;
    const messagesHit =
      messagesThreshold <= 0
        ? delta.pendingMessages > 0
        : delta.pendingMessages >= messagesThreshold;
    if (!bytesHit && !messagesHit) {
      continue;
    }
    dirtyFiles.push(sessionFile);
    delta.pendingBytes = bytesThreshold > 0 ? Math.max(0, delta.pendingBytes - bytesThreshold) : 0;
    delta.pendingMessages =
      messagesThreshold > 0 ? Math.max(0, delta.pendingMessages - messagesThreshold) : 0;
    shouldSync = true;
  }

  return { dirtyFiles, shouldSync };
}

/**
 * Update the delta tracking state (lastSize, pendingBytes, pendingMessages)
 * for a single session file.
 */
export async function updateSessionDelta(params: {
  sessionFile: string;
  deltas: Map<string, SessionDeltaState>;
  thresholds: SessionDeltaThresholds | undefined;
}): Promise<{
  deltaBytes: number;
  deltaMessages: number;
  pendingBytes: number;
  pendingMessages: number;
} | null> {
  const { sessionFile, deltas, thresholds } = params;
  if (!thresholds) {
    return null;
  }
  let stat: { size: number };
  try {
    stat = await fs.stat(sessionFile);
  } catch {
    return null;
  }
  const size = stat.size;
  let state = deltas.get(sessionFile);
  if (!state) {
    state = { lastSize: 0, pendingBytes: 0, pendingMessages: 0 };
    deltas.set(sessionFile, state);
  }
  const deltaBytes = Math.max(0, size - state.lastSize);
  if (deltaBytes === 0 && size === state.lastSize) {
    return {
      deltaBytes: thresholds.deltaBytes,
      deltaMessages: thresholds.deltaMessages,
      pendingBytes: state.pendingBytes,
      pendingMessages: state.pendingMessages,
    };
  }
  if (size < state.lastSize) {
    state.lastSize = size;
    state.pendingBytes += size;
    const shouldCountMessages =
      thresholds.deltaMessages > 0 &&
      (thresholds.deltaBytes <= 0 || state.pendingBytes < thresholds.deltaBytes);
    if (shouldCountMessages) {
      state.pendingMessages += await countNewlines({ absPath: sessionFile, start: 0, end: size });
    }
  } else {
    state.pendingBytes += deltaBytes;
    const shouldCountMessages =
      thresholds.deltaMessages > 0 &&
      (thresholds.deltaBytes <= 0 || state.pendingBytes < thresholds.deltaBytes);
    if (shouldCountMessages) {
      state.pendingMessages += await countNewlines({
        absPath: sessionFile,
        start: state.lastSize,
        end: size,
      });
    }
    state.lastSize = size;
  }
  deltas.set(sessionFile, state);
  return {
    deltaBytes: thresholds.deltaBytes,
    deltaMessages: thresholds.deltaMessages,
    pendingBytes: state.pendingBytes,
    pendingMessages: state.pendingMessages,
  };
}

/**
 * Count newline characters (0x0A) in a byte range of a file.
 */
export async function countNewlines(params: {
  absPath: string;
  start: number;
  end: number;
}): Promise<number> {
  const { absPath, start, end } = params;
  if (end <= start) {
    return 0;
  }
  const handle = await fs.open(absPath, "r");
  try {
    let offset = start;
    let count = 0;
    const buffer = Buffer.alloc(SESSION_DELTA_READ_CHUNK_BYTES);
    while (offset < end) {
      const toRead = Math.min(buffer.length, end - offset);
      const { bytesRead } = await handle.read(buffer, 0, toRead, offset);
      if (bytesRead <= 0) {
        break;
      }
      for (let i = 0; i < bytesRead; i += 1) {
        if (buffer[i] === 10) {
          count += 1;
        }
      }
      offset += bytesRead;
    }
    return count;
  } finally {
    await handle.close();
  }
}

/**
 * Reset delta tracking for a session file after it has been synced.
 */
export function resetSessionDelta(params: {
  absPath: string;
  size: number;
  deltas: Map<string, SessionDeltaState>;
}): void {
  const state = params.deltas.get(params.absPath);
  if (!state) {
    return;
  }
  state.lastSize = params.size;
  state.pendingBytes = 0;
  state.pendingMessages = 0;
}

/**
 * Check whether a session file belongs to this agent's sessions directory.
 */
export function isSessionFileForAgent(params: { sessionFile: string; agentId: string }): boolean {
  if (!params.sessionFile) {
    return false;
  }
  const sessionsDir = resolveSessionTranscriptsDirForAgent(params.agentId);
  const resolvedFile = path.resolve(params.sessionFile);
  const resolvedDir = path.resolve(sessionsDir);
  return resolvedFile.startsWith(`${resolvedDir}${path.sep}`);
}
