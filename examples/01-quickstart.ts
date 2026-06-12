/**
 * 01 — Quickstart: deterministic gates + tamper-evident receipts
 *
 * The simplest Surety setup: rules decide, every decision leaves a receipt.
 * No trust ledger, no human gates yet — see 02-earned-autonomy.ts for those.
 *
 * Run: npx tsx examples/01-quickstart.ts
 */
import { BondLimits, createGuard, verifyChain, type ActionReceipt } from '../src/index.js'

// Hard daily ceilings: 100 actions, £100.00 spend (always integer minor units).
const limits = new BondLimits({ max_actions_per_day: 100, max_spend_per_day_minor: 10_000 })

const guard = createGuard(
  [
    limits.rule(),
    {
      id: 'refund-ceiling',
      check: (a) => a.type !== 'payment.refund' || (a.payload.amount_minor as number) <= 5000,
      reason: 'Refunds above £50.00 require human approval',
    },
    {
      id: 'internal-email-only',
      check: (a) => a.type !== 'email.send' || String(a.payload.to).endsWith('@example.com'),
      reason: 'Agents may only email internal addresses',
    },
  ],
  { agent_id: 'billing-agent', chain: true } // chain: true → receipts hash-link
)

const auditLog: ActionReceipt[] = []

// The agent (an LLM somewhere) proposes; the guard decides — deterministically.
const proposed = [
  { type: 'email.send', payload: { to: 'ops@example.com', subject: 'Invoice 1042 chased' } },
  { type: 'email.send', payload: { to: 'mark@competitor.io', subject: 'psst' } },
  { type: 'payment.refund', payload: { invoice: 'INV-1042', amount_minor: 9900 } },
  { type: 'payment.refund', payload: { invoice: 'INV-1043', amount_minor: 1500 }, estimated_cost_minor: 1500 },
]

for (const action of proposed) {
  const result = guard(action)
  auditLog.push(result.receipt)

  if (result.allowed) {
    console.log(`✅ ${action.type.padEnd(16)} executed        receipt:${result.receipt.id.slice(0, 8)}`)
    limits.record(action) // budget commits only after execution
  } else {
    console.log(`⛔ ${action.type.padEnd(16)} ${result.reasons[0]}`)
  }
}

// Anyone — including a third party — can verify the audit trail wasn't tampered with.
console.log(`\nAudit chain intact : ${verifyChain(auditLog) === -1 ? 'yes' : 'NO — TAMPERED'}`)
console.log(`Budget remaining   :`, limits.remaining())

// Tamper with history and watch verification catch it:
auditLog[1] = { ...auditLog[1]!, allowed: true }
console.log(`After tampering    : broken at receipt #${verifyChain(auditLog)}`)
