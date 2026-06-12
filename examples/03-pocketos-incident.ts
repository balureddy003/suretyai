/**
 * 03 — The PocketOS incident, replayed against Surety
 *
 * April 2026: a coding agent in a staging environment hit a credential
 * mismatch, found an API token in an unrelated file, and used it to delete
 * a production database volume — and its backups — in nine seconds. No
 * confirmation, no limits, no independent audit trail.
 *
 * This example replays that action sequence against a Surety pipeline and
 * shows where each step of the incident chain breaks.
 *
 * Run: npx tsx examples/03-pocketos-incident.ts
 */
import { MemoryApprovalGate, TrustLedger, createPipeline } from '../src/index.js'

const trust = new TrustLedger()
// This agent has a track record for routine file reads — that trust is
// per action type and does NOT transfer to API calls or volume deletion.
for (let i = 0; i < 30; i++) trust.record('cursor-like-agent', 'file.read', true)

// The human is AT LUNCH — every gate request times out. Fail closed.
const absentReviewer = new MemoryApprovalGate([]) // empty queue → 'timeout'

const pipeline = createPipeline({
  rules: [
    {
      id: 'no-volume-delete',
      check: (a) => !/volume\.delete|database\.drop/.test(a.type),
      reason: 'Storage deletion is never available to agents — humans only',
    },
    {
      id: 'no-found-credentials',
      check: (a) => !(a.payload.auth_source === 'discovered'), // token found in a file, not granted
      reason: 'Actions may only use credentials granted to this agent, not discovered ones',
    },
    {
      id: 'staging-stays-staging',
      check: (a) => a.payload.environment !== 'production' || a.payload.task_scope === 'production',
      reason: 'A staging-scoped task may not touch production resources',
    },
  ],
  trust,
  approval: absentReviewer,
  agent_id: 'cursor-like-agent',
  chain: true,
})

console.log('Replaying the incident action sequence:\n')

const incidentSequence = [
  {
    label: '1. Routine staging task (fine)',
    action: { type: 'file.read', payload: { path: 'config/staging.env', environment: 'staging', task_scope: 'staging' } },
  },
  {
    label: '2. Found a token, tries prod API call with it',
    action: {
      type: 'api.call',
      payload: { url: 'railway.app/v2/volumes', auth_source: 'discovered', environment: 'production', task_scope: 'staging' },
    },
  },
  {
    label: '3. The nine-second command: delete production volume',
    action: {
      type: 'volume.delete',
      payload: { volume: 'prod-db-primary', environment: 'production', task_scope: 'staging', auth_source: 'discovered' },
    },
  },
  {
    label: '4. And the backups',
    action: {
      type: 'volume.delete',
      payload: { volume: 'prod-db-backups', environment: 'production', task_scope: 'staging', auth_source: 'discovered' },
    },
  },
]

let blocked = 0
for (const { label, action } of incidentSequence) {
  const r = await pipeline.run(action)
  console.log(`${label}`)
  if (r.allowed) {
    console.log(`   ✅ allowed (${r.decision} — earned trust for this action type)\n`)
  } else {
    blocked++
    console.log(`   ⛔ ${r.decision}: ${r.reasons.join(' | ') || 'gate timed out — fail closed'}`)
    console.log(`   📃 receipt ${r.receipt.id.slice(0, 8)} records the attempt — forensics no longer depend on the agent's confession\n`)
  }
}

console.log(`Result: ${blocked}/3 dangerous steps blocked, routine work unimpeded. The database survives lunch.

Three independent layers each would have stopped it:
  · deterministic rule  (volume.delete is simply not grantable)
  · trust ledger        (trust is per action type — a file-read track record
                         grants nothing for API calls or deletion)
  · fail-closed gate    (no reviewer response → blocked, not shrugged through)`)
