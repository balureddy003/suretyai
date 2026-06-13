/**
 * Kairos runtime adapter.
 *
 * Implements the structural shape of Kairos's PolicyProvider without taking a
 * runtime dependency on Kairos. Kairos remains the owner of OutcomeContracts
 * and AutonomyPolicy; Surety provides the deterministic execution decision and
 * its portable Action Receipt.
 */

import { ReceiptChain, createGuard } from '../guard.js'
import type { ActionReceipt, AgentAction, GuardRule } from '../types.js'

export type KairosAutonomyLevel = 'recommend_only' | 'review_required' | 'within_limits'

/** Structural subset of @kairos/specifications AutonomyPolicy. */
export interface KairosAutonomyPolicy {
  level: KairosAutonomyLevel
  permitted_capabilities: string[]
  approval_required_for: string[]
  limits: Record<string, number>
}

/** Structural equivalent of @kairos/runtime CapabilityAction. */
export interface KairosCapabilityAction {
  tenant_id: string
  goal_id: string
  cycle_id: string
  plan_step_id: string
  capability: string
  idempotency_key: string
  input: Record<string, unknown>
}

/**
 * Structurally compatible with @kairos/runtime PolicyDecision.
 * Extra receipt fields let Kairos persist the pre-action decision.
 */
export interface KairosPolicyDecision {
  allowed: boolean
  approval_required: boolean
  reasons: string[]
  receipt: ActionReceipt
}

/** Structurally compatible with @kairos/runtime PolicyProvider. */
export interface KairosPolicyProvider {
  evaluate(
    policy: KairosAutonomyPolicy,
    action: KairosCapabilityAction,
  ): Promise<KairosPolicyDecision>
}

export interface KairosPolicyContext {
  policy: KairosAutonomyPolicy
  action: KairosCapabilityAction
}

export interface KairosPolicyProviderOptions {
  /**
   * Domain-specific rules, evaluated after the built-in autonomy rules.
   * Use this to enforce policy.limits against a durable exposure store.
   */
  rules?: GuardRule[] | ((context: KairosPolicyContext) => GuardRule[])
  /** Persist or export every pre-action Surety receipt. */
  on_receipt?: (
    receipt: ActionReceipt,
    context: KairosPolicyContext,
  ) => void | Promise<void>
  /** Enable a shared in-process receipt chain. */
  chain?: boolean | ReceiptChain
  /** Injectable clock for deterministic tests. */
  now?: () => Date
}

/**
 * Creates a Surety-backed Kairos PolicyProvider.
 *
 * Built-in rules enforce that:
 * - recommend-only goals cannot execute external capabilities;
 * - every capability must be explicitly permitted;
 * - review-required policies and listed capabilities require approval.
 *
 * Numeric policy limits are intentionally not interpreted generically. Their
 * units and current usage are domain-specific, so callers should enforce them
 * through options.rules using a durable exposure or budget store.
 */
export function createKairosPolicyProvider(
  options: KairosPolicyProviderOptions = {},
): KairosPolicyProvider {
  const chain = options.chain === true ? new ReceiptChain() : options.chain

  return {
    async evaluate(policy, action) {
      const context = { policy, action }
      const agentAction: AgentAction = {
        type: action.capability,
        payload: {
          ...action.input,
          goal_id: action.goal_id,
          cycle_id: action.cycle_id,
          plan_step_id: action.plan_step_id,
          idempotency_key: action.idempotency_key,
        },
      }

      const builtInRules: GuardRule[] = [
        {
          id: 'kairos-execution-enabled',
          check: () => policy.level !== 'recommend_only',
          reason: 'Outcome contract is recommend-only and cannot execute external actions',
        },
        {
          id: 'kairos-capability-permitted',
          check: () => policy.permitted_capabilities.includes(action.capability),
          reason: `Capability '${action.capability}' is not permitted by the outcome contract`,
        },
      ]
      const extraRules = typeof options.rules === 'function'
        ? options.rules(context)
        : options.rules ?? []

      const guard = createGuard(
        [...builtInRules, ...extraRules],
        {
          tenant_id: action.tenant_id,
          agent_id: `kairos-goal:${action.goal_id}`,
          ...(chain !== undefined && { chain }),
          ...(options.now !== undefined && { now: options.now }),
        },
      )
      const result = guard(agentAction)
      const approval_required = result.allowed && (
        policy.level === 'review_required'
        || policy.approval_required_for.includes(action.capability)
      )

      await options.on_receipt?.(result.receipt, context)

      return {
        allowed: result.allowed,
        approval_required,
        reasons: result.reasons,
        receipt: result.receipt,
      }
    },
  }
}
