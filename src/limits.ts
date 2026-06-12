import type { AgentAction, GuardRule } from './types.js'

export interface BondLimitsConfig {
  /** Hard ceiling on executed actions per UTC day. */
  max_actions_per_day?: number
  /** Hard ceiling on spend per UTC day, in integer minor units (cents/pence). */
  max_spend_per_day_minor?: number
  /** Injectable clock, for deterministic tests. */
  now?: () => Date
}

/**
 * Bond limits — hard daily circuit breakers on agent activity.
 *
 * Limits are checked at gate time via rule() and committed after
 * execution via record(), so blocked or abandoned actions never
 * consume budget:
 *
 * ```ts
 * const limits = new BondLimits({ max_actions_per_day: 50, max_spend_per_day_minor: 10_000 })
 * const guard = createGuard([limits.rule(), ...otherRules])
 *
 * const result = guard(action)
 * if (result.allowed) {
 *   await execute(action)
 *   limits.record(action)
 * }
 * ```
 *
 * Counters reset at UTC midnight. State is in-memory and per-instance;
 * persist externally if you need limits to survive restarts.
 */
export class BondLimits {
  private day = ''
  private actions = 0
  private spendMinor = 0

  constructor(private readonly config: BondLimitsConfig) {}

  /** A guard rule that blocks actions which would exceed today's limits. */
  rule(): GuardRule {
    return {
      id: 'bond-limits',
      check: (action) => this.wouldAllow(action),
      reason: 'Daily bond limit reached (actions or spend ceiling)',
    }
  }

  /** Commits an executed action against today's budget. Call only after execution. */
  record(action: AgentAction): void {
    this.roll()
    this.actions += 1
    this.spendMinor += action.estimated_cost_minor ?? 0
  }

  /** Remaining budget for today. */
  remaining(): { actions: number | null; spend_minor: number | null } {
    this.roll()
    return {
      actions:
        this.config.max_actions_per_day !== undefined
          ? Math.max(0, this.config.max_actions_per_day - this.actions)
          : null,
      spend_minor:
        this.config.max_spend_per_day_minor !== undefined
          ? Math.max(0, this.config.max_spend_per_day_minor - this.spendMinor)
          : null,
    }
  }

  private wouldAllow(action: AgentAction): boolean {
    this.roll()
    if (
      this.config.max_actions_per_day !== undefined &&
      this.actions + 1 > this.config.max_actions_per_day
    ) {
      return false
    }
    if (
      this.config.max_spend_per_day_minor !== undefined &&
      this.spendMinor + (action.estimated_cost_minor ?? 0) > this.config.max_spend_per_day_minor
    ) {
      return false
    }
    return true
  }

  private roll(): void {
    const today = (this.config.now?.() ?? new Date()).toISOString().slice(0, 10)
    if (today !== this.day) {
      this.day = today
      this.actions = 0
      this.spendMinor = 0
    }
  }
}
