import { createHash, randomUUID } from 'node:crypto'
import { canonicalize } from './canonical.js'
import type { ActionReceipt, AgentAction, GuardResult, GuardRule } from './types.js'

/** The Action Receipt spec version this library implements. */
export const SPEC_VERSION = 'action-receipt/v0.1' as const

export interface GuardOptions {
  /** Recorded as agent_id on every receipt. */
  agent_id?: string
  /** Recorded as tenant_id on every receipt. */
  tenant_id?: string
  /**
   * Tamper-evident chaining. `true` gives the guard its own ReceiptChain;
   * pass a ReceiptChain instance to share one chain across components
   * (e.g. the pipeline links FINAL receipts after gate enrichment, so the
   * stored chain always verifies).
   */
  chain?: boolean | ReceiptChain
  /** Injectable clock, for deterministic tests. */
  now?: () => Date
}

/**
 * Links receipts into a tamper-evident hash chain. Each linked receipt
 * carries the SHA-256 of the previously linked one.
 *
 * IMPORTANT: link the receipt you intend to STORE. A receipt mutated after
 * linking will break verifyChain() — by design.
 */
export class ReceiptChain {
  private prev: string | undefined

  link(receipt: ActionReceipt): ActionReceipt {
    const linked: ActionReceipt =
      this.prev !== undefined ? { ...receipt, prev_receipt_hash: this.prev } : receipt
    this.prev = hashReceipt(linked)
    return linked
  }
}

/** A guard function: present an action, receive a decision and its receipt. */
export type Guard = (action: AgentAction) => GuardResult

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/** SHA-256 hex digest of the canonical JSON serialization of a payload. */
export function hashPayload(payload: Record<string, unknown>): string {
  return sha256(canonicalize(payload))
}

/** SHA-256 hex digest of a receipt's canonical JSON serialization. */
export function hashReceipt(receipt: ActionReceipt): string {
  return sha256(canonicalize(receipt))
}

/**
 * Creates a deterministic guard that evaluates agent actions against a
 * set of rules and issues an Action Receipt for every decision.
 *
 * Rules are pure predicates — no LLM is consulted, so the same action
 * always produces the same decision.
 *
 * @example
 * ```ts
 * const guard = createGuard([
 *   {
 *     id: 'refund-ceiling',
 *     check: (a) => a.type !== 'payment.refund' || (a.payload.amount_minor as number) <= 5000,
 *     reason: 'Refunds above £50.00 require human approval',
 *   },
 * ])
 *
 * const result = guard({ type: 'payment.refund', payload: { amount_minor: 9900 } })
 * // result.allowed === false; result.receipt is the audit record
 * ```
 */
export function createGuard(rules: GuardRule[], options: GuardOptions = {}): Guard {
  const chain =
    options.chain === true ? new ReceiptChain() : options.chain instanceof ReceiptChain ? options.chain : undefined

  return (action: AgentAction): GuardResult => {
    const failed = rules.filter((rule) => !rule.check(action))
    const allowed = failed.length === 0

    const receipt: ActionReceipt = {
      id: randomUUID(),
      spec: SPEC_VERSION,
      ...(options.agent_id !== undefined && { agent_id: options.agent_id }),
      ...(options.tenant_id !== undefined && { tenant_id: options.tenant_id }),
      action_type: action.type,
      payload_hash: hashPayload(action.payload),
      timestamp: (options.now?.() ?? new Date()).toISOString(),
      allowed,
      failed_rules: failed.map((rule) => rule.id),
      ...(allowed ? {} : { outcome: 'policy_blocked' as const }),
    }

    return {
      allowed,
      failed_rules: failed.map((rule) => rule.id),
      reasons: failed.map((rule) => rule.reason),
      receipt: chain ? chain.link(receipt) : receipt,
    }
  }
}

/**
 * Verifies a chained sequence of receipts: each receipt's
 * prev_receipt_hash must equal the hash of the receipt before it.
 * Returns the index of the first broken link, or -1 if the chain is intact.
 */
export function verifyChain(receipts: ActionReceipt[]): number {
  for (let i = 1; i < receipts.length; i++) {
    const expected = hashReceipt(receipts[i - 1]!)
    if (receipts[i]!.prev_receipt_hash !== expected) {
      return i
    }
  }
  return -1
}
