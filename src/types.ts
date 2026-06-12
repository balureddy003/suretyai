/**
 * Core types for Surety AI and the Action Receipt v0.1 specification.
 *
 * See spec/action-receipt.md for the normative field definitions.
 */

/** An action an agent intends to perform, presented to the guard before execution. */
export interface AgentAction {
  /** Namespaced action type, e.g. 'email.send', 'payment.refund', 'crm.note'. */
  type: string
  /** Structured action arguments. Hashed into the receipt; never stored by Surety. */
  payload: Record<string, unknown>
  /** Estimated cost of the action in integer minor units (cents/pence). Used by bond limits. */
  estimated_cost_minor?: number
}

/** A deterministic predicate over an action. Rules must never call an LLM. */
export interface GuardRule {
  /** Stable identifier recorded in receipts when the rule blocks an action. */
  id: string
  /** Returns true when the action passes this rule. Must be deterministic. */
  check: (action: AgentAction) => boolean
  /** Human-readable explanation used when the rule blocks an action. */
  reason: string
}

/** Lifecycle outcome recorded after the gate decision, when known. */
export type ReceiptOutcome = 'executed' | 'policy_blocked' | 'dry_run' | 'failed'

/**
 * Action Receipt v0.1 — the tamper-evident record of a gate decision.
 *
 * Field names and semantics are normative; see spec/action-receipt.md.
 */
export interface ActionReceipt {
  /** UUID v4, unique per decision. */
  id: string
  /** Spec identifier, always 'action-receipt/v0.1' for this version. */
  spec: 'action-receipt/v0.1'
  /** Identifier of the agent whose action was evaluated. */
  agent_id?: string
  /** Tenant scope for multi-tenant deployments. */
  tenant_id?: string
  /** The action's namespaced type. */
  action_type: string
  /** SHA-256 hex digest of the canonical JSON serialization of the payload. */
  payload_hash: string
  /** ISO 8601 timestamp of the decision. */
  timestamp: string
  /** true = action allowed, false = blocked. */
  allowed: boolean
  /** IDs of the rules that blocked the action. Empty when allowed. */
  failed_rules: string[]
  /** What actually happened after the decision, when known. */
  outcome?: ReceiptOutcome
  /** Human-readable reason for a block or failure. */
  outcome_reason?: string
  /** true when the action was simulated rather than executed. */
  dry_run?: boolean
  /** SHA-256 hex digest of the previous receipt, forming a tamper-evident chain. */
  prev_receipt_hash?: string
}

/** Result of presenting an action to a guard. */
export interface GuardResult {
  /** true when every rule passed. */
  allowed: boolean
  /** IDs of the rules that failed. */
  failed_rules: string[]
  /** Human-readable reasons from the failed rules, in the same order. */
  reasons: string[]
  /** The Action Receipt recording this decision. */
  receipt: ActionReceipt
}
