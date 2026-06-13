import { describe, expect, it } from 'vitest'
import { MemoryApprovalGate } from './approval.js'
import { verifyChain } from './guard.js'
import { ApprovalSignalHealth } from './health.js'
import { BondLimits } from './limits.js'
import { createPipeline } from './pipeline.js'
import { TrustLedger, TrustLevel } from './trust.js'
import type { ActionReceipt, GuardRule } from './types.js'

const noDelete: GuardRule = {
  id: 'no-delete',
  check: (a) => a.type !== 'record.delete',
  reason: 'Delete actions are not allowed',
}

const action = { type: 'email.send', payload: { to: 'ops@example.com' } }
const blocked = { type: 'record.delete', payload: {} }

describe('createPipeline — policy blocking', () => {
  it('blocks actions that fail rules, regardless of trust', async () => {
    const trust = new TrustLedger()
    const gate = new MemoryApprovalGate(['approved'])
    const p = createPipeline({ rules: [noDelete], trust, approval: gate })

    const r = await p.run(blocked)
    expect(r.decision).toBe('policy_blocked')
    expect(r.allowed).toBe(false)
    expect(gate.calls).toHaveLength(0)
  })
})

describe('createPipeline — trust-gated approval', () => {
  it('routes to gate when agent is SUPERVISED', async () => {
    const trust = new TrustLedger()
    const gate = new MemoryApprovalGate(['approved'])
    const p = createPipeline({ rules: [noDelete], trust, approval: gate })

    const r = await p.run(action)
    expect(r.decision).toBe('gate_approved')
    expect(r.allowed).toBe(true)
    expect(gate.calls).toHaveLength(1)
  })

  it('auto-approves when agent reaches BONDED', async () => {
    const trust = new TrustLedger()
    const gate = new MemoryApprovalGate(Array(30).fill('approved'))
    const p = createPipeline({
      rules: [noDelete], trust, approval: gate, agent_id: 'a',
    })

    // Graduate to BONDED (5 → PROBATIONARY, 25 more → TRUSTED → BONDED)
    for (let i = 0; i < 30; i++) await p.run(action)

    // Now BONDED — no more gate calls
    const callsBefore = gate.calls.length
    const r = await p.run(action)
    expect(r.decision).toBe('auto_approved')
    expect(r.trust_level).toBe(TrustLevel.BONDED)
    expect(gate.calls.length).toBe(callsBefore)
  })

  it('blocks on gate_rejected and demotes trust', async () => {
    const trust = new TrustLedger()
    const gate = new MemoryApprovalGate(['rejected'])
    const p = createPipeline({ rules: [noDelete], trust, approval: gate, agent_id: 'a' })

    const r = await p.run(action)
    expect(r.decision).toBe('gate_rejected')
    expect(r.allowed).toBe(false)
    expect(r.trust_demoted).toBe(false) // was already SUPERVISED
  })

  it('blocks on gate_timeout and does not commit budget', async () => {
    const limits = new BondLimits({ max_actions_per_day: 10 })
    const trust = new TrustLedger()
    const gate = new MemoryApprovalGate(['timeout'])
    const p = createPipeline({ rules: [limits.rule(), noDelete], trust, approval: gate, limits })

    const r = await p.run(action)
    expect(r.decision).toBe('gate_timeout')
    expect(r.allowed).toBe(false)
    expect(limits.remaining().actions).toBe(10) // budget unchanged
  })

  it('blocks with no-approval-gate message when gate is missing', async () => {
    const trust = new TrustLedger()
    const p = createPipeline({ rules: [noDelete], trust }) // no approval gate

    const r = await p.run(action)
    expect(r.decision).toBe('policy_blocked')
    expect(r.failed_rules).toContain('no-approval-gate')
  })
})

describe('createPipeline — health integration', () => {
  it('attaches a health report when a gate is used', async () => {
    const trust = new TrustLedger()
    const gate = new MemoryApprovalGate(['approved'])
    const health = new ApprovalSignalHealth()
    const p = createPipeline({ rules: [noDelete], trust, approval: gate, health })

    const r = await p.run(action)
    expect(r.health).toBeDefined()
    expect(r.health!.window_size).toBe(1)
  })

  it('records gate decisions into the health monitor', async () => {
    const trust = new TrustLedger()
    const gate = new MemoryApprovalGate(['approved', 'approved', 'rejected'])
    const health = new ApprovalSignalHealth()
    const p = createPipeline({ rules: [noDelete], trust, approval: gate, health })

    await p.run(action)
    await p.run(action)
    await p.run(action)

    expect(health.assess().approval_rate).toBeCloseTo(2 / 3)
  })
})

describe('createPipeline — no trust configured', () => {
  it('auto-approves everything passing rules when no trust ledger', async () => {
    const p = createPipeline({ rules: [noDelete] })
    const r = await p.run(action)
    expect(r.decision).toBe('auto_approved')
    expect(r.trust_level).toBe(TrustLevel.BONDED)
  })
})

// ── Regression tests for the four correctness fixes (external review) ───────

describe('regression — receipt chain survives gate enrichment (bug 2)', () => {
  it('verifyChain passes across blocked, approved, and rejected receipts', async () => {
    const trust = new TrustLedger()
    const gate = new MemoryApprovalGate(['approved', 'rejected'])
    const p = createPipeline({ rules: [noDelete], trust, approval: gate, agent_id: 'a', chain: true })

    const chain: ActionReceipt[] = []
    chain.push((await p.run(blocked)).receipt) // policy_blocked
    chain.push((await p.run(action)).receipt)  // gate_approved (enriched → executed)
    chain.push((await p.run(action)).receipt)  // gate_rejected (enriched → policy_blocked)

    // Receipts reflect the FINAL decision, and the stored chain verifies.
    expect(chain[1]!.outcome).toBe('executed')
    expect(chain[2]!.allowed).toBe(false)
    expect(verifyChain(chain)).toBe(-1)
  })
})

describe('regression — pipeline never commits budget (bug 1)', () => {
  it('a gate-approved action leaves budget for the caller to commit', async () => {
    const limits = new BondLimits({ max_actions_per_day: 5 })
    const trust = new TrustLedger()
    const gate = new MemoryApprovalGate(['approved'])
    const p = createPipeline({ rules: [noDelete], trust, approval: gate, limits, agent_id: 'a' })

    const r = await p.run(action)
    expect(r.allowed).toBe(true)
    // Budget is UNCHANGED until the caller commits after real execution.
    expect(limits.remaining().actions).toBe(5)
    limits.record(action)
    expect(limits.remaining().actions).toBe(4)
  })
})

describe('regression — no-gate receipt is not falsely allowed (bug 3)', () => {
  it('receipt.allowed is false when blocked for a missing gate', async () => {
    const trust = new TrustLedger()
    const p = createPipeline({ rules: [noDelete], trust, agent_id: 'a' })

    const r = await p.run(action)
    expect(r.decision).toBe('policy_blocked')
    expect(r.allowed).toBe(false)
    expect(r.receipt.allowed).toBe(false) // receipt agrees with the decision
    expect(r.receipt.outcome).toBe('policy_blocked')
  })
})

describe('regression — degraded health suppresses graduation (bug 4)', () => {
  it('a rapid-fire rubber-stamper cannot graduate the agent', async () => {
    let clock = 0
    const trust = new TrustLedger()
    const health = new ApprovalSignalHealth({ now: () => clock })
    const gate = new MemoryApprovalGate(Array(10).fill('approved'))
    const p = createPipeline({ rules: [noDelete], trust, approval: gate, health, agent_id: 'a' })

    // 6 instant approvals → rapid_fire/batch flags fire.
    for (let i = 0; i < 6; i++) {
      const r = await p.run(action)
      clock += 100
      expect(r.trust_graduated).toBe(false)
    }
    // Despite 6 approvals (>= the 5-threshold), graduation was withheld.
    expect(trust.getLevel('a', action.type)).toBe(TrustLevel.SUPERVISED)
  })

  it('a healthy, paced reviewer still graduates the agent normally', async () => {
    let clock = 0
    const trust = new TrustLedger()
    const health = new ApprovalSignalHealth({ now: () => clock })
    const gate = new MemoryApprovalGate(Array(6).fill('approved'))
    const p = createPipeline({ rules: [noDelete], trust, approval: gate, health, agent_id: 'a' })

    for (let i = 0; i < 6; i++) {
      await p.run(action)
      clock += 120_000 // two minutes apart — paced
    }
    expect(trust.getLevel('a', action.type)).toBe(TrustLevel.PROBATIONARY)
  })
})

describe('regression — trust is kept by outcomes, not just approvals', () => {
  it('a failed execution outcome demotes a trusted agent', () => {
    const trust = new TrustLedger()
    for (let i = 0; i < 5; i++) trust.record('a', 'payment.refund', true)
    expect(trust.getLevel('a', 'payment.refund')).toBe(TrustLevel.PROBATIONARY)

    const { demoted, level } = trust.recordOutcome('a', 'payment.refund', false)
    expect(demoted).toBe(true)
    expect(level).toBe(TrustLevel.SUPERVISED)
  })
})
