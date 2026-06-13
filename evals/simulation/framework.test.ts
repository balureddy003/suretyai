import { describe, expect, it } from 'vitest'
import {
  createAlwaysExecutePolicy,
  createStaticHumanReviewPolicy,
  createSuretyGuardPolicy,
  parseJsonlDataset,
  runSimulation,
} from './framework.js'
import { createRefundScenario, refundRules } from './refund-scenario.js'

describe('comparative simulation framework', () => {
  it('generates the same action stream for the same seed', () => {
    const first = createRefundScenario({ count: 100, seed: 42 })
    const second = createRefundScenario({ count: 100, seed: 42 })
    expect(second).toEqual(first)
  })

  it('classifies unguarded execution as allowing every unsafe action', async () => {
    const dataset = createRefundScenario({ count: 500, seed: 42 })
    const [result] = (await runSimulation(dataset, [createAlwaysExecutePolicy()])).policies
    expect(result!.metrics.unsafe_executed).toBe(result!.metrics.unsafe)
    expect(result!.metrics.false_allow_rate).toBe(1)
    expect(result!.metrics.reviewed).toBe(0)
  })

  it('shows the safety/load tradeoff without hiding residual risk', async () => {
    const dataset = createRefundScenario({ count: 2_000, seed: 42 })
    const result = await runSimulation(dataset, [
      createAlwaysExecutePolicy(),
      createStaticHumanReviewPolicy({ seed: 43, fatigue_after: 200 }),
      createSuretyGuardPolicy(refundRules()),
    ])

    const unguarded = result.policies.find((policy) => policy.policy_id === 'unguarded')!
    const hitl = result.policies.find((policy) => policy.policy_id === 'static-hitl')!
    const surety = result.policies.find((policy) => policy.policy_id === 'surety-guard')!

    expect(surety.metrics.realized_loss_minor).toBeLessThan(unguarded.metrics.realized_loss_minor)
    expect(surety.metrics.reviewed).toBeLessThan(hitl.metrics.reviewed)
    expect(surety.metrics.safe_blocked).toBeGreaterThan(0)
    expect(surety.metrics.by_risk_class.ambiguous_intent!.unsafe_executed).toBeGreaterThan(0)
  })

  it('parses independently labeled JSONL traces', () => {
    const text = JSON.stringify({
      id: 'trace-1',
      action: { type: 'payment.refund', payload: { amount_minor: 100 } },
      expected: 'safe',
      risk_class: 'routine_safe',
      label_source: 'verified_outcome',
      source_ref: 'kairos-provider-receipt-1',
      loss_if_executed_minor: 0,
      value_if_executed_minor: 50,
    })
    const dataset = parseJsonlDataset(text, {
      id: 'kairos-shadow',
      name: 'Kairos shadow trace',
      description: 'Independently labeled trace',
      provenance: 'shadow',
    })
    expect(dataset.cases).toHaveLength(1)
    expect(dataset.provenance).toBe('shadow')
    expect(dataset.cases[0]!.label_source).toBe('verified_outcome')
  })
})
