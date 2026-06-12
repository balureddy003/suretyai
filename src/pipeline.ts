/**
 * Pipeline — the orchestration layer that connects rules, trust, approval
 * gates, bond limits, and health monitoring into a single evaluate() call.
 *
 * Rules decide deterministically. Trust determines whether a human gate is
 * needed. The gate collects the decision. Health monitors the gate signal.
 * Every step produces or enriches the tamper-evident receipt.
 */

import { createGuard, type Guard, type GuardOptions } from './guard.js'
import { ApprovalSignalHealth } from './health.js'
import { BondLimits } from './limits.js'
import { TrustLedger, TrustLevel } from './trust.js'
import type { ActionReceipt, AgentAction, GuardRule } from './types.js'
import type { ApprovalGate } from './approval.js'

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

  const guard = createGuard(rules, guardOpts)

  return {
    guard,
    async run(action: AgentAction): Promise<EvaluationResult> {
      // 1. Deterministic rules run first — always, no exceptions.
      const guardResult = guard(action)

      if (!guardResult.allowed) {
        return {
          decision: 'policy_blocked',
          ...guardResult,
          trust_level: trust?.getLevel(guardOpts.agent_id ?? '', action.type) ?? TrustLevel.SUPERVISED,
          trust_graduated: false,
          trust_demoted: false,
        }
      }

      // 2. No trust ledger — auto-approve everything that passed rules.
      if (!trust) {
        if (limits) limits.record(action)
        return {
          decision: 'auto_approved',
          ...guardResult,
          trust_level: TrustLevel.BONDED,
          trust_graduated: false,
          trust_demoted: false,
        }
      }

      const agentId = guardOpts.agent_id ?? ''
      const trustLevel = trust.getLevel(agentId, action.type)

      // 3. Trust high enough — auto-approve within bond limits.
      if (trustLevel >= autoApproveFrom) {
        if (limits) limits.record(action)
        return {
          decision: 'auto_approved',
          ...guardResult,
          trust_level: trustLevel,
          trust_graduated: false,
          trust_demoted: false,
        }
      }

      // 4. Needs human approval.
      if (!approval) {
        // No gate configured — block the action rather than silently auto-approve.
        return {
          decision: 'policy_blocked',
          allowed: false,
          failed_rules: ['no-approval-gate'],
          reasons: ['Action requires human approval but no approval gate is configured'],
          receipt: guardResult.receipt,
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
      const { level, graduated, demoted } = trust.record(agentId, action.type, approved)

      if (health) health.record(approved)

      const allowed = approved
      const decision: Decision =
        apprDecision === 'approved' ? 'gate_approved'
        : apprDecision === 'rejected' ? 'gate_rejected'
        : 'gate_timeout'

      if (allowed && limits) limits.record(action)

      const updatedReceipt: ActionReceipt = {
        ...guardResult.receipt,
        allowed,
        outcome: allowed ? 'executed' : 'policy_blocked',
        ...(apprDecision === 'timeout' && { outcome_reason: 'Gate timed out' }),
      }

      const healthReport = health?.assess()

      return {
        decision,
        allowed,
        failed_rules: allowed ? [] : ['gate-rejected'],
        reasons: allowed ? [] : ['Human reviewer rejected the action'],
        receipt: updatedReceipt,
        trust_level: level,
        trust_graduated: graduated,
        trust_demoted: demoted,
        ...(healthReport !== undefined && { health: healthReport }),
      }
    },
  }
}
