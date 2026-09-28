/** Extract the first meaningful sibling call site (outside node internals/pkg). */
export function getCallSite(): { file: string; line: number; text: string } | undefined {
  const err = new Error();
  const lines = (err.stack ?? "").split("\n");
  for (const line of lines) {
    if (!line.includes("at ")) continue;
    if (line.includes("node:internal")) continue;
    if (line.includes("hangcheck/src/") || line.includes("hangcheck/dist/")) continue;
    if (line.includes("node_modules")) continue;

    const match = line.match(
      /at\s+(?:.*?\s)?\(?([^\s()]+\.(?:ts|tsx|js|jsx|mjs|cjs))(?:\?[^\s()]*)?:(\d+):(\d+)\)?/,
    );
    if (match) {
      return {
        file: match[1],
        line: Number(match[2]),
        text: `${match[1]}:${match[2]}`,
      };
    }
  }
  return undefined;
}

const supportColor =
  typeof process !== "undefined" && process.stderr?.isTTY === true;

export const c = {
  yellow: (s: string) => (supportColor ? `\x1b[33m${s}\x1b[0m` : s),
  green: (s: string) => (supportColor ? `\x1b[36m${s}\x1b[0m` : s),
  red: (s: string) => (supportColor ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s: string) => (supportColor ? `\x1b[90m${s}\x1b[0m` : s),
  gray: (s: string) => (supportColor ? `\x1b[90m${s}\x1b[0m` : s),
} as const;

let output: NonNullable<import("./types").PromiseLeakConfig["output"]> = "console";
const buffer: string[] = [];

export function configureOutput(next: NonNullable<import("./types").PromiseLeakConfig["output"]>): void {
  output = next;
}

export function emit(message: string): void {
  if (output === "console") console.error(message);
  else if (output === "buffer") buffer.push(message);
  else if (typeof output === "function") output(message);
}

export function readBuffer(): string[] {
  return buffer.slice();
}

export function clearBuffer(): void {
  buffer.length = 0;
}

export function formatMs(value: number): string {
  if (value >= 60_000) return `${(value / 60_000).toFixed(1)}m`;
  if (value >= 10_000) return `${Math.round((value / 1000) * 10) / 10}s`;
  return `${Math.round(value * 10) / 10}ms`;
}

/**
 * ⚠ Promise still pending after 10 seconds
 *
 * confirm-payment
 *
 * Created at:
 * src/services/payment.ts:52
 */
export function formatPendingWarning(
  label: string,
  pendingMs: number,
  warnAfterMs: number,
  where?: { text: string },
): string {
  const lines: string[] = [];
  lines.push(c.yellow(`⚠ Promise still pending after ${formatMs(warnAfterMs)}`));
  lines.push("");
  lines.push(label);
  if (where) {
    lines.push("");
    lines.push("Created at:");
    lines.push(supportColor ? c.gray(where.text) : where.text);
  }
  lines.push("");
  lines.push(`Pending for: ${formatMs(pendingMs)}`);
  return lines.join("\n");
}

/** Group pending/resolved list. */
export function formatGroupReport(label: string, entries: Array<{ label: string; pending: boolean; createdAt: number }>): string {
  const lines: string[] = [label, ""];
  for (const e of entries) {
    lines.push(e.pending ? `⚠ ${e.label} pending ${formatMs(Date.now() - e.createdAt)}` : `✓ ${e.label}`);
  }
  return lines.join("\n");
}
