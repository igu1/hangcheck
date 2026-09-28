export interface CallSite {
  file: string;
  line: number;
  text: string;
}

export interface PromiseLeakConfig {
  /** warn once the promise has been pending this long in ms (default 10s) */
  warnAfter?: number;
  /** pending this long and the warning repeats every `repeatAfter` ms (default 30s) */
  repeatAfter?: number;
  /** "console" | "silent" | "buffer" | custom logger */
  output?: "console" | "silent" | "buffer" | ((message: string) => void);
  /** inject a clock for tests */
  now?: () => number;
}

export interface TrackedEntry {
  label: string;
  createdAt: number;
  callsite?: CallSite;
  pending: boolean;
}

export interface LeakGroupReport {
  label: string;
  pending: TrackedEntry[];
  resolved: number;
}
