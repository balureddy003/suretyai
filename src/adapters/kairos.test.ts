import { describe, expect, it, vi } from 'vitest'
import {
  createKairosPolicyProvider,
  type KairosAutonomyPolicy,
  type KairosCapabilityAction,
} from './kairos.js'

const action: KairosCapabilityAction = {
  tenant_id: 'tenant-1',
  goal_id: 'goal-1',
  cycle_id: 'cycle-1',
  plan_step_id: 'step-1',
  capability: 'payment.refund',
  idempotency_key: 'refund-1',
  input: { amount_minor: 2500 },
}

function policy(
  overrides: Partial<KairosAutonomyPolicy> = {},
): KairosAutonomyPolicy {
  return {
    level: 'within_limits',
    permitted_capabilities: ['payment.refund'],
    approval_required_for: [],
    limits: {},
    ...overrides,
  }
}

describe('createKairosPolicyProvider', () => {
  it('allows an explicitly permitted capability within limits', async () => {
    const provider = createKairosPolicyProvider()

    const result = await provider.evaluate(policy(), action)

    expect(result.allowed).toBe(true)
    expect(result.approval_required).toBe(false)
    expect(result.receipt).toMatchObject({
      agent_id: 'kairos-goal:goal-1',
      tenant_id: 'tenant-1',
      action_type: 'payment.refund',
      allowed: true,
    })
  })

  it('blocks recommend-only outcome contracts', async () => {
    const provider = createKairosPolicyProvider()

    const result = await provider.evaluate(policy({ level: 'recommend_only' }), action)

    expect(result.allowed).toBe(false)
    expect(result.approval_required).toBe(false)
    expect(result.receipt.failed_rules).toContain('kairos-execution-enabled')
  })

  it('blocks capabilities not permitted by the outcome contract', async () => {
    const provider = createKairosPolicyProvider()

    const result = await provider.evaluate(
      policy({ permitted_capabilities: ['invoice.read'] }),
      action,
    )

    expect(result.allowed).toBe(false)
    expect(result.receipt.failed_rules).toContain('kairos-capability-permitted')
  })

  it('requires approval when the policy or capability requires review', async () => {
    const provider = createKairosPolicyProvider()

    const policyReview = await provider.evaluate(
      policy({ level: 'review_required' }),
      action,
    )
    const capabilityReview = await provider.evaluate(
      policy({ approval_required_for: ['payment.refund'] }),
      action,
    )

    expect(policyReview).toMatchObject({ allowed: true, approval_required: true })
    expect(capabilityReview).toMatchObject({ allowed: true, approval_required: true })
  })

  it('applies domain-specific exposure rules and exports receipts', async () => {
    const onReceipt = vi.fn()
    const provider = createKairosPolicyProvider({
      rules: ({ policy: currentPolicy }) => [{
        id: 'refund-exposure',
        check: (candidate) =>
          (candidate.payload.amount_minor as number)
          <= (currentPolicy.limits.max_refund_minor ?? 0),
        reason: 'Refund exceeds the outcome contract exposure limit',
      }],
      on_receipt: onReceipt,
    })

    const result = await provider.evaluate(
      policy({ limits: { max_refund_minor: 1000 } }),
      action,
    )

    expect(result.allowed).toBe(false)
    expect(result.receipt.failed_rules).toContain('refund-exposure')
    expect(onReceipt).toHaveBeenCalledOnce()
  })

  it('hashes the full nested action context into the receipt', async () => {
    const provider = createKairosPolicyProvider()
    const first = await provider.evaluate(policy(), {
      ...action,
      input: { customer: { id: 'cus-1', tier: 'gold' } },
    })
    const second = await provider.evaluate(policy(), {
      ...action,
      input: { customer: { id: 'cus-1', tier: 'basic' } },
    })

    expect(first.receipt.payload_hash).not.toBe(second.receipt.payload_hash)
  })
})
