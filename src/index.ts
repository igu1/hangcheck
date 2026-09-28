import {
  clearBuffer,
  c,
  configureOutput,
  emit,
  formatGroupReport,
  formatMs,
  formatPendingWarning,
  getCallSite,
  readBuffer,
} from "./format";
import type { CallSite, PromiseLeakConfig, TrackedEntry } from "./types";

const DEFAULT_WARN_AFTER = 10_000;
const DEFAULT_REPEAT_AFTER = 30_000;

interface TrackedPromise {
  label: string;
  createdAt: number;
  callsite?: CallSite;
  pending: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

const tracked = new Map<Promise<unknown>, TrackedPromise>();

let config: Required<Omit<PromiseLeakConfig, "output" | "now">> & {
  output?: PromiseLeakConfig["output"];
};
let now: () => number = () => Date.now();

function defaults(): void {
  config = {
    warnAfter: DEFAULT_WARN_AFTER,
    repeatAfter: DEFAULT_REPEAT_AFTER,
  };
}
defaults();

/** Configure thresholds and output. */
export function configure(options: PromiseLeakConfig = {}): void {
  defaults();
  if (options.warnAfter !== undefined) config.warnAfter = options.warnAfter;
  if (options.repeatAfter !== undefined) config.repeatAfter = options.repeatAfter;
  if (options.output) configureOutput(options.output);
  if (options.now) now = options.now;
}

/** Warnings collected with "buffer" mode. */
export function bufferWarnings(): string[] {
  return readBuffer();
}

export function resetBuffer(): void {
  clearBuffer();
}

/** Everything currently tracked (optionally filter to pending). */
export function registry(pendingOnly = false): TrackedEntry[] {
  return [...tracked.values()]
    .filter((t) => (pendingOnly ? t.pending : true))
    .map((t) => ({
      label: t.label,
      createdAt: t.createdAt,
      callsite: t.callsite,
      pending: t.pending,
    }));
}

function scheduleAlert(trackedEntry: TrackedPromise): void {
  const tick = () => {
    if (!trackedEntry.pending) return;
    const age = now() - trackedEntry.createdAt;
    emit(
      formatPendingWarning(
        trackedEntry.label,
        age,
        config.warnAfter,
        trackedEntry.callsite,
      ),
    );
    if (config.repeatAfter > 0) {
      trackedEntry.timer = setTimeout(tick, config.repeatAfter);
      unref(trackedEntry.timer);
    }
  };
  trackedEntry.timer = setTimeout(tick, config.warnAfter);
  unref(trackedEntry.timer);
}

function unref(timer: { unref?: () => void }): void {
  timer.unref?.();
}

/**
 * Track a promise and warn when it does not settle in time.
 * The original promise passes through untouched:
 *
 * ```ts
 * await track("confirm-payment", confirmPayment());
 * ```
 */
export function track<T>(label: string, promise: Promise<T>): Promise<T> {
  const entry: TrackedPromise = {
    label,
    createdAt: now(),
    callsite: getCallSite(),
    pending: true,
  };
  tracked.set(promise as Promise<unknown>, entry);

  scheduleAlert(entry);

  const cleanup = () => {
    entry.pending = false;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = undefined;
    }
  };

  promise.then(cleanup, cleanup);
  return promise;
}

/** Run all group promises: labels appear in the pending report. */
export async function trackGroup<T>(
  label: string,
  trackedPromises: Array<Promise<unknown>>,
): Promise<T[]> {
  const subEntries: TrackedPromise[] = [];
  const subLabels = trackedPromises.map((_, i) => `${label}[${i}]`);

  trackedPromises.forEach((promise, i) => {
    const entry: TrackedPromise = {
      label: subLabels[i],
      createdAt: now(),
      callsite: getCallSite(),
      pending: true,
    };
    subEntries.push(entry);
    tracked.set(promise, entry);
    const cleanup = () => {
      entry.pending = false;
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = undefined;
      }
    };
    promise.then(cleanup, cleanup);
  });

  const groupTimer: { timer?: ReturnType<typeof setTimeout> } = {};
  groupTimer.timer = setTimeout(() => {
    const stillPending = subEntries.filter((e) => e.pending);
    if (stillPending.length === 0) return;

    const lines = [c.yellow(`⚠ group "${label}" has ${stillPending.length} pending promise(s)\n`)];
    for (const e of subEntries) {
      lines.push(
        `  ${e.pending ? `⚠ ${e.label} pending ${formatMs(now() - e.createdAt)}` : c.green(`✓ ${e.label}`)}`,
      );
    }
    emit(lines.join("\n"));
  }, config.warnAfter);
  unref(groupTimer.timer);

  // declarations used for closure cleanup
  void tracked;

  return Promise.all(trackedPromises) as Promise<T[]>;
}

export function resetRegistry(): void {
  for (const entry of tracked.values()) {
    if (entry.timer) clearTimeout(entry.timer);
    entry.pending = false;
  }
  tracked.clear();
}

export { c };
