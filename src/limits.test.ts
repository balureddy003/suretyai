import { describe, expect, it } from 'vitest'
import { createGuard } from './guard.js'
import { BondLimits } from './limits.js'
import type { AgentAction } from './types.js'

const send: AgentAction = { type: 'email.send', payload: {}, estimated_cost_minor: 100 }

describe('BondLimits', () => {
  it('blocks actions beyond the daily action ceiling', () => {
    const limits = new BondLimits({ max_actions_per_day: 2 })
    const guard = createGuard([limits.rule()])

    for (let i = 0; i < 2; i++) {
      expect(guard(send).allowed).toBe(true)
      limits.record(send)
    }
    const third = guard(send)
    expect(third.allowed).toBe(false)
    expect(third.failed_rules).toEqual(['bond-limits'])
  })

  it('blocks actions that would exceed the daily spend ceiling', () => {
    const limits = new BondLimits({ max_spend_per_day_minor: 250 })
    const guard = createGuard([limits.rule()])

    expect(guard(send).allowed).toBe(true)
    limits.record(send) // spent 100
    expect(guard(send).allowed).toBe(true)
    limits.record(send) // spent 200
    expect(guard(send).allowed).toBe(false) // 300 > 250
    expect(limits.remaining().spend_minor).toBe(50)
  })

  it('does not consume budget at gate time — only record() commits', () => {
    const limits = new BondLimits({ max_actions_per_day: 1 })
    const guard = createGuard([limits.rule()])

    for (let i = 0; i < 5; i++) {
      expect(guard(send).allowed).toBe(true)
    }
    limits.record(send)
    expect(guard(send).allowed).toBe(false)
  })

  it('resets counters at UTC midnight', () => {
    let now = new Date('2026-06-10T23:50:00Z')
    const limits = new BondLimits({ max_actions_per_day: 1, now: () => now })
    const guard = createGuard([limits.rule()])

    expect(guard(send).allowed).toBe(true)
    limits.record(send)
    expect(guard(send).allowed).toBe(false)

    now = new Date('2026-06-11T00:01:00Z')
    expect(guard(send).allowed).toBe(true)
  })
})
