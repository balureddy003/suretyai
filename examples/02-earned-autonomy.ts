/**
 * 02 — Earned autonomy: watch an agent graduate in 60 seconds
 *
 * The core Surety idea. New agents start SUPERVISED (every action needs a
 * human). A clean track record graduates them PROBATIONARY → TRUSTED →
 * BONDED, at which point routine actions auto-approve inside hard bond
 * limits. Trust is asymmetric: one rejection demotes instantly.
 *
 * The human reviewer is simulated so this runs unattended; swap
 * MemoryApprovalGate for ConsoleApprovalGate to approve interactively.
 *
 * Run: npx tsx examples/02-earned-autonomy.ts
 */
import {
  ApprovalSignalHealth,
  BondLimits,
  MemoryApprovalGate,
  TrustLedger,
  TrustLevel,
  TRUST_LEVEL_NAMES,
  createPipeline,
} from '../src/index.js'

const trust = new TrustLedger()
const health = new ApprovalSignalHealth()
const limits = new BondLimits({ max_actions_per_day: 500, max_spend_per_day_minor: 500_000 })
const reviewer = new MemoryApprovalGate(Array(100).fill('approved'))

const pipeline = createPipeline({
  rules: [
    limits.rule(),
    {
      id: 'refund-ceiling',
      check: (a) => a.type !== 'payment.refund' || (a.payload.amount_minor as number) <= 5000,
      reason: 'Refunds above £50.00 are never automatic',
    },
  ],
  trust,
  approval: reviewer,
  health,
  limits,
  agent_id: 'billing-agent',
  chain: true,
})

const refund = (n: number) => ({
  type: 'payment.refund',
  payload: { invoice: `INV-${1000 + n}`, amount_minor: 1500 },
  estimated_cost_minor: 1500,
})

console.log('Phase 1 — a new agent works 100 routine refunds:\n')
console.log('   #  decision        trust level')
console.log('  ──  ──────────────  ─────────────')

let human = 0
let auto = 0
for (let n = 1; n <= 100; n++) {
  const r = await pipeline.run(refund(n))
  if (r.decision === 'auto_approved') auto++
  else human++
  if (r.trust_graduated || n === 1) {
    console.log(
      `  ${String(n).padStart(2)}  ${r.decision.padEnd(14)}  ${TRUST_LEVEL_NAMES[r.trust_level]}${r.trust_graduated ? '  🎓' : ''}`
    )
  }
}

console.log(`
  human approvals needed : ${human}    (static HITL: 100)
  auto-approved (bonded) : ${auto}
  approval-load reduction: ${Math.round((1 - human / 100) * 100)}%  — and it keeps climbing as volume grows
  oversight health       : ${health.assess().healthy ? 'healthy' : `⚠ ${health.assess().flags.join(', ')}`}

  (That health warning is correct! Our SIMULATED reviewer approved 30
   times instantly with zero variance — the textbook rubber-stamp
   pattern. With a real, paced human it stays healthy. The monitor
   can't be fooled even by the demo that ships with the library.)`)

console.log('\nPhase 2 — a routine spot-check finds a bad refund:\n')

// The human audits a sample of auto-approved actions and rejects one.
const { level, demoted } = trust.record('billing-agent', 'payment.refund', false)
console.log(`  spot-check rejection → ${demoted ? 'demoted' : 'no change'}: now ${TRUST_LEVEL_NAMES[level]}`)

const next = await pipeline.run(refund(101))
console.log(`  next refund          → ${next.decision} (back under human review)`)

console.log(`
Trust is asymmetric by design: 30 clean approvals to earn autonomy,
one rejection to lose it. Exactly how it works with people.`)
