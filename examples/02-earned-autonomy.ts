/**
 * 02 — Earned autonomy: watch an agent graduate, then prove its work
 *
 * The core Surety idea. New agents start SUPERVISED (every action needs a
 * human). A clean track record graduates them PROBATIONARY → TRUSTED →
 * BONDED, at which point routine actions auto-approve inside hard bond
 * limits. Trust is asymmetric: one rejection — or one failed outcome —
 * demotes instantly.
 *
 * The human reviewer is simulated so this runs unattended. We advance an
 * injected clock ~2 minutes between decisions so the reviewer reads as a
 * genuine, paced human — if we hammered approvals in a tight loop, the
 * health monitor would (correctly) flag rubber-stamping and SUSPEND
 * graduation. See example output's health line.
 *
 * Run: npx tsx examples/02-earned-autonomy.ts
 */
import {
  ApprovalSignalHealth,
  BondLimits,
  MemoryApprovalGate,
  TrustLedger,
  TRUST_LEVEL_NAMES,
  createPipeline,
} from '../src/index.js'

// Simulated wall clock: each reviewer decision is ~2 minutes apart.
let clock = Date.UTC(2026, 0, 1)
const advance = () => (clock += 120_000)

const trust = new TrustLedger()
const health = new ApprovalSignalHealth({ now: () => clock })
const limits = new BondLimits({ max_actions_per_day: 500, max_spend_per_day_minor: 500_000 })
const reviewer = new MemoryApprovalGate(Array(100).fill('approved'))

const pipeline = createPipeline({
  rules: [
    {
      id: 'refund-ceiling',
      check: (a) => a.type !== 'payment.refund' || (a.payload.amount_minor as number) <= 5000,
      reason: 'Refunds above £50.00 are never automatic',
    },
  ],
  trust,
  approval: reviewer,
  health,
  limits, // CHECKED at the gate; the caller commits after execution
  agent_id: 'billing-agent',
  chain: true,
})

const refund = (n: number) => ({
  type: 'payment.refund',
  payload: { invoice: `INV-${1000 + n}`, amount_minor: 1500 },
  estimated_cost_minor: 1500,
})

console.log('Phase 1 — a new agent works 100 routine £15 refunds:\n')
console.log('   #  decision        trust level')
console.log('  ──  ──────────────  ─────────────')

let human = 0
let auto = 0
for (let n = 1; n <= 100; n++) {
  const r = await pipeline.run(refund(n))
  if (r.decision === 'auto_approved') {
    auto++
  } else {
    human++
    advance() // a real human spent real time on this one
  }
  // The caller commits budget only after a real (here, simulated) execution.
  if (r.allowed) limits.record(refund(n))

  if (r.trust_graduated || n === 1) {
    console.log(
      `  ${String(n).padStart(2)}  ${r.decision.padEnd(14)}  ${TRUST_LEVEL_NAMES[r.trust_level]}${r.trust_graduated ? '  🎓' : ''}`
    )
  }
}

const report = health.assess()
const spentMinor = 500_000 - (limits.remaining().spend_minor ?? 500_000)
console.log(`
  human approvals needed : ${human}    (static HITL would need 100)
  auto-approved (bonded) : ${auto}
  approval-load reduction: ${Math.round((1 - human / 100) * 100)}%  — and it keeps climbing as volume grows
  oversight health       : ${report.healthy ? 'healthy ✅' : `flags: ${report.flags.join(', ')}`}
  spend committed today  : £${(spentMinor / 100).toFixed(2)} of £5000.00 daily limit

  Note: 'no_variance' may show because a flawless agent legitimately earns
  all-approvals — it's reported for visibility but does NOT suspend autonomy.
  Rapid-fire / batch / dismiss-spike patterns DO suspend it.`)

console.log('\nPhase 2 — autonomy is kept by RESULTS, not just approvals:\n')

// A spot-check finds that one auto-approved refund actually failed downstream
// (duplicate refund, chargeback, wrong account). Approval was a prediction;
// the outcome is ground truth — and it demotes.
const outcome = trust.recordOutcome('billing-agent', 'payment.refund', false)
console.log(`  failed execution outcome → ${outcome.demoted ? 'demoted' : 'no change'}: now ${TRUST_LEVEL_NAMES[outcome.level]}`)

const next = await pipeline.run(refund(101))
console.log(`  next refund              → ${next.decision} (back under human review)`)

console.log(`
Trust is asymmetric by design: ~30 clean, paced approvals to earn autonomy;
one rejection OR one failed outcome to lose it. Exactly how it works with people.`)
