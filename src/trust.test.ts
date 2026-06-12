import { describe, expect, it } from 'vitest'
import { TrustLedger, TrustLevel } from './trust.js'

describe('TrustLedger — graduation', () => {
  it('starts every new pair at SUPERVISED', () => {
    const t = new TrustLedger()
    expect(t.getLevel('agent-1', 'email.send')).toBe(TrustLevel.SUPERVISED)
  })

  it('graduates SUPERVISED → PROBATIONARY after 5 consecutive approvals', () => {
    const t = new TrustLedger()
    for (let i = 0; i < 4; i++) t.record('a', 'email.send', true)
    expect(t.getLevel('a', 'email.send')).toBe(TrustLevel.SUPERVISED)

    const { level, graduated } = t.record('a', 'email.send', true)
    expect(level).toBe(TrustLevel.PROBATIONARY)
    expect(graduated).toBe(true)
  })

  it('does not graduate on a different action type', () => {
    const t = new TrustLedger()
    for (let i = 0; i < 5; i++) t.record('a', 'email.send', true)
    expect(t.getLevel('a', 'payment.refund')).toBe(TrustLevel.SUPERVISED)
  })

  it('graduates PROBATIONARY → TRUSTED after 15 approvals with low rejection rate', () => {
    const t = new TrustLedger()
    for (let i = 0; i < 5; i++) t.record('a', 'x', true)    // → PROBATIONARY
    for (let i = 0; i < 10; i++) t.record('a', 'x', true)   // 15 total
    expect(t.getLevel('a', 'x')).toBe(TrustLevel.TRUSTED)
  })

  it('does not graduate PROBATIONARY → TRUSTED if rejection rate too high', () => {
    const t = new TrustLedger()
    for (let i = 0; i < 5; i++) t.record('a', 'x', true)    // → PROBATIONARY
    for (let i = 0; i < 8; i++) t.record('a', 'x', true)
    for (let i = 0; i < 5; i++) t.record('a', 'x', false)   // 5/18 ≈ 28% reject rate
    expect(t.getLevel('a', 'x')).toBeLessThan(TrustLevel.TRUSTED)
  })

  it('graduates all the way to BONDED with a clean track record', () => {
    const t = new TrustLedger()
    for (let i = 0; i < 5; i++) t.record('a', 'x', true)    // → PROBATIONARY
    for (let i = 0; i < 25; i++) t.record('a', 'x', true)   // → TRUSTED at 15, BONDED at 30
    expect(t.getLevel('a', 'x')).toBe(TrustLevel.BONDED)
  })
})

describe('TrustLedger — demotion', () => {
  it('demotes immediately on rejection and resets consecutive counter', () => {
    const t = new TrustLedger()
    for (let i = 0; i < 5; i++) t.record('a', 'x', true)    // → PROBATIONARY
    const { level, demoted } = t.record('a', 'x', false)

    expect(level).toBe(TrustLevel.SUPERVISED)
    expect(demoted).toBe(true)
    expect(t.getEntry('a', 'x').consecutive_approvals).toBe(0)
  })

  it('does not demote below SUPERVISED', () => {
    const t = new TrustLedger()
    t.record('a', 'x', false)
    expect(t.getLevel('a', 'x')).toBe(TrustLevel.SUPERVISED)
  })

  it('demotes BONDED → TRUSTED on a single rejection', () => {
    const t = new TrustLedger()
    for (let i = 0; i < 5; i++) t.record('a', 'x', true)
    for (let i = 0; i < 25; i++) t.record('a', 'x', true)   // → BONDED
    expect(t.getLevel('a', 'x')).toBe(TrustLevel.BONDED)

    t.record('a', 'x', false)
    expect(t.getLevel('a', 'x')).toBe(TrustLevel.TRUSTED)
  })
})

describe('TrustLedger — persistence', () => {
  it('exports and restores state faithfully', () => {
    const t1 = new TrustLedger()
    for (let i = 0; i < 5; i++) t1.record('a', 'x', true)
    expect(t1.getLevel('a', 'x')).toBe(TrustLevel.PROBATIONARY)

    const t2 = TrustLedger.from(t1.export())
    expect(t2.getLevel('a', 'x')).toBe(TrustLevel.PROBATIONARY)
    expect(t2.getEntry('a', 'x').approvals).toBe(5)
  })
})
