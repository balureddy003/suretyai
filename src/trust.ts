/**
 * Graduated trust — agents earn autonomy through track record, never by assumption.
 *
 * Trust is per (agent_id, action_type) pair. An agent trusted to send emails
 * is not automatically trusted to issue refunds. Rejection at any level demotes
 * immediately, resetting the consecutive-approval counter.
 */

export enum TrustLevel {
  /** Every action requires human approval. Starting level for all new agents. */
  SUPERVISED = 0,
  /** Most actions require approval; low-risk patterns may auto-approve. */
  PROBATIONARY = 1,
  /** Routine actions auto-approve; high-risk still gate. */
  TRUSTED = 2,
  /**
   * All actions auto-approve within bond limits.
   * Requires the longest approval history and lowest rejection rate.
   */
  BONDED = 3,
}

export const TRUST_LEVEL_NAMES: Record<TrustLevel, string> = {
  [TrustLevel.SUPERVISED]: 'supervised',
  [TrustLevel.PROBATIONARY]: 'probationary',
  [TrustLevel.TRUSTED]: 'trusted',
  [TrustLevel.BONDED]: 'bonded',
}

export interface TrustEntry {
  agent_id: string
  action_type: string
  level: TrustLevel
  approvals: number
  rejections: number
  /** Consecutive approvals since last rejection or demotion. */
  consecutive_approvals: number
  /** Execution outcomes reported via recordOutcome(). */
  outcomes_succeeded?: number
  outcomes_failed?: number
  updated_at: string
}

export interface RecordOptions {
  /**
   * Record the decision but do not graduate. Used by the pipeline when
   * oversight health is degraded: approvals from a rubber-stamping
   * reviewer are not valid signal for granting MORE autonomy.
   * Demotion on rejection always applies — safety is never suppressed.
   */
  suppress_graduation?: boolean
}

export interface GraduationThresholds {
  /** Consecutive approvals needed to go SUPERVISED → PROBATIONARY. Default 5. */
  supervised_to_probationary: number
  /** Total approvals + max rejection rate to go PROBATIONARY → TRUSTED. */
  probationary_to_trusted_approvals: number
  probationary_to_trusted_max_rejection_rate: number
  /** Total approvals + max rejection rate to go TRUSTED → BONDED. */
  trusted_to_bonded_approvals: number
  trusted_to_bonded_max_rejection_rate: number
}

const DEFAULT_THRESHOLDS: GraduationThresholds = {
  supervised_to_probationary: 5,
  probationary_to_trusted_approvals: 15,
  probationary_to_trusted_max_rejection_rate: 0.15,
  trusted_to_bonded_approvals: 30,
  trusted_to_bonded_max_rejection_rate: 0.05,
}

export interface TrustLedgerOptions {
  thresholds?: Partial<GraduationThresholds>
  now?: () => Date
}

export type TrustLedgerState = Record<string, TrustEntry>

/**
 * Tracks per-(agent, action_type) trust levels. Records every approval and
 * rejection, graduates agents up through trust levels when thresholds are met,
 * and demotes immediately on rejection.
 *
 * @example
 * ```ts
 * const trust = new TrustLedger()
 *
 * // New agents start supervised — every action needs human approval
 * trust.getLevel('agent-1', 'payment.refund') // TrustLevel.SUPERVISED
 *
 * // Record 5 consecutive approvals → graduates to PROBATIONARY
 * for (let i = 0; i < 5; i++) trust.record('agent-1', 'payment.refund', true)
 * trust.getLevel('agent-1', 'payment.refund') // TrustLevel.PROBATIONARY
 *
 * // One rejection → demotes back to SUPERVISED, resets streak
 * trust.record('agent-1', 'payment.refund', false)
 * trust.getLevel('agent-1', 'payment.refund') // TrustLevel.SUPERVISED
 * ```
 */
export class TrustLedger {
  private entries = new Map<string, TrustEntry>()
  private thresholds: GraduationThresholds
  private now: () => Date

  constructor(options: TrustLedgerOptions = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds }
    this.now = options.now ?? (() => new Date())
  }

  /** Current trust level for an (agent, action_type) pair. */
  getLevel(agent_id: string, action_type: string): TrustLevel {
    return this.getOrCreate(agent_id, action_type).level
  }

  /** Full trust entry for an (agent, action_type) pair. */
  getEntry(agent_id: string, action_type: string): TrustEntry {
    return { ...this.getOrCreate(agent_id, action_type) }
  }

  /**
   * Records a human approval or rejection decision and updates the trust level.
   * Returns the trust level *after* recording, and whether graduation occurred.
   */
  record(
    agent_id: string,
    action_type: string,
    approved: boolean,
    options: RecordOptions = {}
  ): { level: TrustLevel; graduated: boolean; demoted: boolean } {
    const entry = this.getOrCreate(agent_id, action_type)
    const prevLevel = entry.level

    if (approved) {
      entry.approvals += 1
      entry.consecutive_approvals += 1
    } else {
      entry.rejections += 1
      entry.consecutive_approvals = 0
      if (entry.level > TrustLevel.SUPERVISED) {
        entry.level = (entry.level - 1) as TrustLevel
      }
    }

    if (approved && !options.suppress_graduation) {
      entry.level = this.graduate(entry)
    }

    entry.updated_at = this.now().toISOString()
    this.entries.set(this.key(agent_id, action_type), entry)

    return {
      level: entry.level,
      graduated: entry.level > prevLevel,
      demoted: entry.level < prevLevel,
    }
  }

  /**
   * Records an EXECUTION outcome — did the approved action actually work?
   *
   * Approval is a prediction; the outcome is the ground truth. A failed
   * outcome demotes exactly like a rejection (and counts against the
   * rejection rate), so an agent that collects approvals but doesn't
   * deliver cannot stay bonded. Successful outcomes are recorded but add
   * no approval credit — autonomy is earned at the gate, kept by results.
   */
  recordOutcome(
    agent_id: string,
    action_type: string,
    success: boolean
  ): { level: TrustLevel; demoted: boolean } {
    const entry = this.getOrCreate(agent_id, action_type)
    const prevLevel = entry.level

    if (success) {
      entry.outcomes_succeeded = (entry.outcomes_succeeded ?? 0) + 1
    } else {
      entry.outcomes_failed = (entry.outcomes_failed ?? 0) + 1
      entry.rejections += 1
      entry.consecutive_approvals = 0
      if (entry.level > TrustLevel.SUPERVISED) {
        entry.level = (entry.level - 1) as TrustLevel
      }
    }

    entry.updated_at = this.now().toISOString()
    this.entries.set(this.key(agent_id, action_type), entry)

    return { level: entry.level, demoted: entry.level < prevLevel }
  }

  /** Serialize ledger state for persistence. */
  export(): TrustLedgerState {
    return Object.fromEntries(
      [...this.entries.entries()].map(([k, v]) => [k, { ...v }])
    )
  }

  /** Restore ledger from previously exported state. */
  static from(state: TrustLedgerState, options?: TrustLedgerOptions): TrustLedger {
    const ledger = new TrustLedger(options)
    for (const [key, entry] of Object.entries(state)) {
      ledger.entries.set(key, { ...entry })
    }
    return ledger
  }

  private getOrCreate(agent_id: string, action_type: string): TrustEntry {
    const k = this.key(agent_id, action_type)
    if (!this.entries.has(k)) {
      this.entries.set(k, {
        agent_id,
        action_type,
        level: TrustLevel.SUPERVISED,
        approvals: 0,
        rejections: 0,
        consecutive_approvals: 0,
        updated_at: this.now().toISOString(),
      })
    }
    return this.entries.get(k)!
  }

  private graduate(entry: TrustEntry): TrustLevel {
    const t = this.thresholds
    const total = entry.approvals + entry.rejections
    const rejectionRate = total > 0 ? entry.rejections / total : 0

    if (
      entry.level === TrustLevel.SUPERVISED &&
      entry.consecutive_approvals >= t.supervised_to_probationary
    ) {
      return TrustLevel.PROBATIONARY
    }
    if (
      entry.level === TrustLevel.PROBATIONARY &&
      entry.approvals >= t.probationary_to_trusted_approvals &&
      rejectionRate <= t.probationary_to_trusted_max_rejection_rate
    ) {
      return TrustLevel.TRUSTED
    }
    if (
      entry.level === TrustLevel.TRUSTED &&
      entry.approvals >= t.trusted_to_bonded_approvals &&
      rejectionRate <= t.trusted_to_bonded_max_rejection_rate
    ) {
      return TrustLevel.BONDED
    }
    return entry.level
  }

  private key(agent_id: string, action_type: string): string {
    return `${agent_id}::${action_type}`
  }
}
