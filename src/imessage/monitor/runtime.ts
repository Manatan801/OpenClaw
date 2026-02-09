import type { RuntimeEnv } from "../../runtime.js";
import type { MonitorIMessageOpts } from "./types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

export function resolveRuntime(opts: MonitorIMessageOpts): RuntimeEnv {
  return (
    opts.runtime ?? {
      log: (msg) => createSubsystemLogger("imessage/monitor").info(msg),
      error: (msg) => createSubsystemLogger("imessage/monitor").error(msg),
      exit: (code: number): never => {
        throw new Error(`exit ${code}`);
      },
    }
  );
}

export function normalizeAllowList(list?: Array<string | number>) {
  return (list ?? []).map((entry) => String(entry).trim()).filter(Boolean);
}
