import { describe, expect, it } from 'vitest'
import { ApprovalSignalHealth } from './health.js'

describe('ApprovalSignalHealth', () => {
  it('reports healthy with no decisions recorded', () => {
    const h = new ApprovalSignalHealth()
    const r = h.assess()
    expect(r.healthy).toBe(true)
    expect(r.flags).toEqual([])
  })

  it('flags rapid_fire when >3 decisions in <30s', () => {
    let now = 0
    const h = new ApprovalSignalHealth({ max_window: 200, now: () => now })

    for (let i = 0; i < 4; i++) { h.record(true); now += 100 }

    const r = h.assess()
    expect(r.flags).toContain('rapid_fire')
  })

  it('flags batch_approval when >5 approvals in <60s', () => {
    let now = 0
    const h = new ApprovalSignalHealth({ max_window: 200, now: () => now })

    for (let i = 0; i < 6; i++) { h.record(true); now += 1_000 }

    const r = h.assess()
    expect(r.flags).toContain('batch_approval')
  })

  it('flags no_variance when last 20+ are all approvals', () => {
    const h = new ApprovalSignalHealth()
    for (let i = 0; i < 20; i++) h.record(true)

    const r = h.assess()
    expect(r.flags).toContain('no_variance')
  })

  it('does not flag no_variance with fewer than 20 decisions', () => {
    const h = new ApprovalSignalHealth()
    for (let i = 0; i < 19; i++) h.record(true)

    expect(h.assess().flags).not.toContain('no_variance')
  })

  it('flags dismiss_spike when >30% of last 10 are rejections', () => {
    const h = new ApprovalSignalHealth()
    for (let i = 0; i < 7; i++) h.record(true)
    for (let i = 0; i < 3; i++) h.record(false)   // 30% — exactly at boundary, not over
    expect(h.assess().flags).not.toContain('dismiss_spike')

    h.record(false)                                 // 4/11 ≈ 36% in last 10
    expect(h.assess().flags).toContain('dismiss_spike')
  })

  it('tracks approval_rate correctly', () => {
    const h = new ApprovalSignalHealth()
    for (let i = 0; i < 3; i++) h.record(true)
    h.record(false)
    expect(h.assess().approval_rate).toBeCloseTo(0.75)
  })

  it('prunes old entries beyond max_window', () => {
    const h = new ApprovalSignalHealth({ max_window: 5 })
    for (let i = 0; i < 10; i++) h.record(true)
    expect(h.snapshot().length).toBe(5)
  })
})
