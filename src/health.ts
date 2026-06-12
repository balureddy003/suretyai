/**
 * Approval signal health — detects patterns that indicate human oversight
 * has degraded into rubber-stamping. Guards the guards.
 *
 * When health degrades, the pipeline should pause trust graduation and
 * escalate to a supervisor rather than treating approvals as valid signal.
 */

export type HealthFlag =
  /** More than 3 decisions recorded in under 30 seconds. */
  | 'rapid_fire'
  /** More than 5 approvals recorded in under 60 seconds. */
  | 'batch_approval'
  /** Every decision in the last 20+ was an approval — zero variance. */
  | 'no_variance'
  /** More than 30% of the last 10 decisions were rejections (sudden reversal). */
  | 'dismiss_spike'

export interface HealthReport {
  /** true when no flags are raised. */
  healthy: boolean
  /** Active flags explaining why health is degraded. */
  flags: HealthFlag[]
  /** Number of decisions in the current analysis window. */
  window_size: number
  /** Approval rate across the full window (0–1). */
  approval_rate: number
  assessed_at: string
}

interface Decision {
  timestamp: number
  approved: boolean
}

export interface ApprovalSignalHealthOptions {
  /**
   * Maximum decisions kept in memory. Older entries are pruned.
   * Default 200.
   */
  max_window: number
  now?: () => number
}

/**
 * Monitors the stream of approval decisions and surfaces patterns that
 * indicate oversight has degraded.
 *
 * Healthy oversight has variance (some rejections), is paced (not instant),
 * and is engaged (not rubber-stamping everything).
 *
 * @example
 * ```ts
 * const health = new ApprovalSignalHealth()
 *
 * // After each human decision:
 * health.record(true)   // approved
 * health.record(false)  // rejected
 *
 * const report = health.assess()
 * if (!report.healthy) {
 *   console.warn('Oversight degraded:', report.flags)
 *   // pause trust graduation, alert supervisor
 * }
 * ```
 */
export class ApprovalSignalHealth {
  private window: Decision[] = []
  private opts: Required<ApprovalSignalHealthOptions>

  constructor(options: Partial<ApprovalSignalHealthOptions> = {}) {
    this.opts = {
      max_window: options.max_window ?? 200,
      now: options.now ?? (() => Date.now()),
    }
  }

  /** Record a human approval or rejection. Call after every gate decision. */
  record(approved: boolean): void {
    this.window.push({ timestamp: this.opts.now(), approved })
    if (this.window.length > this.opts.max_window) {
      this.window.shift()
    }
  }

  /** Assess current oversight health and return a report. */
  assess(): HealthReport {
    const now = this.opts.now()
    const flags: HealthFlag[] = []

    const recent30s = this.window.filter((d) => now - d.timestamp < 30_000)
    const recent60s = this.window.filter((d) => now - d.timestamp < 60_000)
    const last20 = this.window.slice(-20)
    const last10 = this.window.slice(-10)

    if (recent30s.length > 3) flags.push('rapid_fire')

    const approvals60s = recent60s.filter((d) => d.approved).length
    if (approvals60s > 5) flags.push('batch_approval')

    if (last20.length >= 20 && last20.every((d) => d.approved)) flags.push('no_variance')

    const rejections10 = last10.filter((d) => !d.approved).length
    if (last10.length >= 10 && rejections10 / last10.length > 0.3) flags.push('dismiss_spike')

    const approvals = this.window.filter((d) => d.approved).length
    const approval_rate = this.window.length > 0 ? approvals / this.window.length : 1

    return {
      healthy: flags.length === 0,
      flags,
      window_size: this.window.length,
      approval_rate,
      assessed_at: new Date(now).toISOString(),
    }
  }

  /** Snapshot of the raw decision window, newest last. */
  snapshot(): ReadonlyArray<Readonly<Decision>> {
    return this.window
  }
}
