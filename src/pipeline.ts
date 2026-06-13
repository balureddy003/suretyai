/**
 * Pipeline — the orchestration layer that connects rules, trust, approval
 * gates, bond limits, and health monitoring into a single evaluate() call.
 *
 * Rules decide deterministically. Trust determines whether a human gate is
 * needed. The gate collects the decision. Health monitors the gate signal.
 * Every step produces or enriches the tamper-evident receipt.
 */

import { ReceiptChain, createGuard, type Guard, type GuardOptions } from './guard.js'
import { ApprovalSignalHealth } from './health.js'
import { BondLimits } from './limits.js'
import { TrustLedger, TrustLevel } from './trust.js'
import type { ActionReceipt, AgentAction, GuardRule } from './types.js'
import type { ApprovalGate } from './approval.js'

/** Health flags that suppress graduation. no_variance is deliberately
 * excluded: a flawless agent legitimately produces all-approvals, so it is
 * reported for visibility (pair with spot-check workflows) but does not
 * block autonomy on its own. */
const SUPPRESSING_FLAGS = new Set(['rapid_fire', 'batch_approval', 'dismiss_spike'])

export type Decision =
  | 'auto_approved'   // trust high enough — no human gate needed
  | 'gate_approved'   // human approved
  | 'gate_rejected'   // human rejected
  | 'gate_timeout'    // gate timed out — action blocked by default
  | 'policy_blocked'  // deterministic rules blocked it

export interface EvaluationResult {
  decision: Decision
  allowed: boolean
  failed_rules: string[]
  reasons: string[]
  receipt: ActionReceipt
  trust_level: TrustLevel
  /** true when this evaluation caused a trust level graduation. */
  trust_graduated: boolean
  /** true when this evaluation caused a trust level demotion. */
  trust_demoted: boolean
  /**
   * true when graduation was withheld because oversight health degraded
   * (rapid_fire / batch_approval / dismiss_spike). The decision itself
   * still stands; the approval just doesn't count toward MORE autonomy.
   */
  graduation_suppressed?: boolean
  /** Current oversight health report, if a gate was involved. */
  health?: ReturnType<ApprovalSignalHealth['assess']>
}

export interface PipelineOptions extends GuardOptions {
  rules: GuardRule[]
  /** Trust ledger. If omitted, all actions without rules blocking them are auto-approved. */
  trust?: TrustLedger
  /** Approval gate. Required when trust is provided; ignored otherwise. */
  approval?: ApprovalGate
  /** Bond limits circuit breaker. */
  limits?: BondLimits
  /** Health monitor. Automatically used when a gate is present. */
  health?: ApprovalSignalHealth
  /**
   * Minimum trust level required for auto-approval (no gate).
   * Default: BONDED — only fully trusted agents bypass the gate.
   */
  auto_approve_from?: TrustLevel
}

export interface Pipeline {
  /** Evaluate an action through the full trust → rules → gate pipeline. */
  run(action: AgentAction): Promise<EvaluationResult>
  /** The underlying synchronous guard, for cases where async isn't needed. */
  readonly guard: Guard
}

/**
 * Creates a pipeline that orchestrates the full Surety AI decision flow.
 *
 * @example
 * ```ts
 * const pipeline = createPipeline({
 *   rules: [limits.rule(), refundCeiling],
 *   trust: new TrustLedger(),
 *   approval: new ConsoleApprovalGate({ timeout_ms: 60_000 }),
 *   limits: new BondLimits({ max_actions_per_day: 100 }),
 *   agent_id: 'billing-agent',
 *   chain: true,
 * })
 *
 * const result = await pipeline.run(action)
 * if (result.allowed) await execute(action)
 * ```
 */
export function createPipeline(options: PipelineOptions): Pipeline {
  const { rules, trust, approval, limits, health, auto_approve_from, ...guardOpts } = options
  const autoApproveFrom = auto_approve_from ?? TrustLevel.BONDED

  // The pipeline owns the chain and links FINAL receipts (after any gate
  // enrichment), so stored chains always pass verifyChain(). The inner
  // guard never chains — its receipt is provisional until the gate decides.
  const { chain: chainOpt, ...innerGuardOpts } = guardOpts
  const chain = chainOpt === true ? new ReceiptChain() : chainOpt instanceof ReceiptChain ? chainOpt : undefined
  const seal = (r: ActionReceipt): ActionReceipt => (chain ? chain.link(r) : r)

  // Limits are CHECKED at the gate (via the auto-included rule below) but
  // never COMMITTED by the pipeline. Budget commits belong to the caller,
  // after successful execution — a gate-approved action that is never
  // executed must not consume budget:
  //   const r = await pipeline.run(action)
  //   if (r.allowed) { await execute(action); limits.record(action) }
  const effectiveRules =
    limits && !rules.some((r) => r.id === 'bond-limits') ? [limits.rule(), ...rules] : rules
  const guard = createGuard(effectiveRules, innerGuardOpts)

  return {
    guard,
    async run(action: AgentAction): Promise<EvaluationResult> {
      // 1. Deterministic rules run first — always, no exceptions.
      //    (The guard links blocked/clean receipts into the chain itself.)
      const guardResult = guard(action)

      if (!guardResult.allowed) {
        return {
          decision: 'policy_blocked',
          ...guardResult,
          receipt: seal(guardResult.receipt),
          trust_level: trust?.getLevel(guardOpts.agent_id ?? '', action.type) ?? TrustLevel.SUPERVISED,
          trust_graduated: false,
          trust_demoted: false,
        }
      }

      // 2. No trust ledger — auto-approve everything that passed rules.
      if (!trust) {
        return {
          decision: 'auto_approved',
          ...guardResult,
          receipt: seal(guardResult.receipt),
          trust_level: TrustLevel.BONDED,
          trust_graduated: false,
          trust_demoted: false,
        }
      }

      const agentId = guardOpts.agent_id ?? ''
      const trustLevel = trust.getLevel(agentId, action.type)

      // 3. Trust high enough — auto-approve within bond limits.
      if (trustLevel >= autoApproveFrom) {
        return {
          decision: 'auto_approved',
          ...guardResult,
          receipt: seal(guardResult.receipt),
          trust_level: trustLevel,
          trust_graduated: false,
          trust_demoted: false,
        }
      }

      // 4. Needs human approval.
      if (!approval) {
        // No gate configured — fail closed, and make the RECEIPT say so too.
        const blockedReceipt = seal({
          ...guardResult.receipt,
          allowed: false,
          failed_rules: ['no-approval-gate'],
          outcome: 'policy_blocked',
          outcome_reason: 'Action requires human approval but no approval gate is configured',
        })
        return {
          decision: 'policy_blocked',
          allowed: false,
          failed_rules: ['no-approval-gate'],
          reasons: ['Action requires human approval but no approval gate is configured'],
          receipt: blockedReceipt,
          trust_level: trustLevel,
          trust_graduated: false,
          trust_demoted: false,
        }
      }

      const apprDecision = await approval.request({
        receipt: guardResult.receipt,
        action,
        trust_level: trustLevel,
      })
      const approved = apprDecision === 'approved'

      // Health records BEFORE trust so the current decision is part of the
      // assessment. Degraded reviewer behavior (rapid-fire, batch,
      // dismiss-spike) means approvals are not valid signal for granting
      // more autonomy — graduation is suppressed; demotion never is.
      if (health) health.record(approved)
      const healthReport = health?.assess()
      const suppressGraduation =
        healthReport !== undefined && healthReport.flags.some((f) => SUPPRESSING_FLAGS.has(f))

      const { level, graduated, demoted } = trust.record(agentId, action.type, approved, {
        suppress_graduation: suppressGraduation,
      })

      const allowed = approved
      const decision: Decision =
        apprDecision === 'approved' ? 'gate_approved'
        : apprDecision === 'rejected' ? 'gate_rejected'
        : 'gate_timeout'

      // Enrich FIRST, then link — the stored receipt is the linked one,
      // so chain verification holds.
      const finalReceipt = seal({
        ...guardResult.receipt,
        allowed,
        outcome: allowed ? 'executed' : 'policy_blocked',
        ...(apprDecision === 'timeout' && { outcome_reason: 'Gate timed out — blocked (fail closed)' }),
        ...(apprDecision === 'rejected' && { outcome_reason: 'Human reviewer rejected the action' }),
      })

      return {
        decision,
        allowed,
        failed_rules: allowed ? [] : [apprDecision === 'timeout' ? 'gate-timeout' : 'gate-rejected'],
        reasons: allowed
          ? []
          : [
              apprDecision === 'timeout'
                ? 'Approval gate timed out — action blocked (fail closed)'
                : 'Human reviewer rejected the action',
            ],
        receipt: finalReceipt,
        trust_level: level,
        trust_graduated: graduated,
        trust_demoted: demoted,
        ...(suppressGraduation && { graduation_suppressed: true }),
        ...(healthReport !== undefined && { health: healthReport }),
      }
    },
  }
}

