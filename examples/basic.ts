/**
 * Gate a toy agent's tools with Surety in ~30 lines.
 *
 * Run: npx tsx examples/basic.ts
 */
import { BondLimits, createGuard, verifyChain, type ActionReceipt } from '../src/index.js'

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
      id: 'no-external-email',
      check: (a) => a.type !== 'email.send' || String(a.payload.to).endsWith('@example.com'),
      reason: 'Agents may only email internal addresses',
    },
  ],
  { agent_id: 'billing-agent', chain: true }
)

const auditLog: ActionReceipt[] = []

// The agent (LLM) proposes actions; the guard decides deterministically.
for (const action of [
  { type: 'email.send', payload: { to: 'ops@example.com', subject: 'Invoice 1042 chased' } },
  { type: 'payment.refund', payload: { invoice: 'INV-1042', amount_minor: 9900 } },
  { type: 'payment.refund', payload: { invoice: 'INV-1043', amount_minor: 1500 }, estimated_cost_minor: 1500 },
]) {
  const result = guard(action)
  auditLog.push(result.receipt)

  if (result.allowed) {
    console.log(`✅ ${action.type} executed`)
    limits.record(action) // commit budget only after execution
  } else {
    console.log(`⛔ ${action.type} blocked: ${result.reasons.join('; ')}`)
  }
}

console.log(`\nAudit chain intact: ${verifyChain(auditLog) === -1}`)
console.log(`Budget remaining today:`, limits.remaining())
