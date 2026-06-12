import { describe, expect, it } from 'vitest'
import { createGuard, hashPayload, hashReceipt, verifyChain, SPEC_VERSION } from './guard.js'
import type { GuardRule } from './types.js'

const noDelete: GuardRule = {
  id: 'no-delete',
  check: (a) => a.type !== 'record.delete',
  reason: 'Delete actions are not allowed',
}

const refundCeiling: GuardRule = {
  id: 'refund-ceiling',
  check: (a) => a.type !== 'payment.refund' || (a.payload.amount_minor as number) <= 5000,
  reason: 'Refunds above 50.00 require human approval',
}

describe('createGuard', () => {
  it('allows actions that pass every rule', () => {
    const guard = createGuard([noDelete, refundCeiling])
    const result = guard({ type: 'payment.refund', payload: { amount_minor: 1200 } })

    expect(result.allowed).toBe(true)
    expect(result.failed_rules).toEqual([])
    expect(result.reasons).toEqual([])
    expect(result.receipt.allowed).toBe(true)
    expect(result.receipt.outcome).toBeUndefined()
  })

  it('blocks actions and records every failed rule with its reason', () => {
    const guard = createGuard([noDelete, refundCeiling])
    const result = guard({ type: 'record.delete', payload: { id: 'x' } })

    expect(result.allowed).toBe(false)
    expect(result.failed_rules).toEqual(['no-delete'])
    expect(result.reasons).toEqual(['Delete actions are not allowed'])
    expect(result.receipt.outcome).toBe('policy_blocked')
  })

  it('stamps receipts with the spec version and identity options', () => {
    const guard = createGuard([noDelete], { agent_id: 'agent-7', tenant_id: 't-1' })
    const { receipt } = guard({ type: 'email.send', payload: {} })

    expect(receipt.spec).toBe(SPEC_VERSION)
    expect(receipt.agent_id).toBe('agent-7')
    expect(receipt.tenant_id).toBe('t-1')
    expect(receipt.action_type).toBe('email.send')
    expect(receipt.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('hashes payloads identically regardless of key order or nesting', () => {
    expect(hashPayload({ to: 'a@b.c', meta: { y: 2, x: 1 } })).toBe(
      hashPayload({ meta: { x: 1, y: 2 }, to: 'a@b.c' })
    )
    expect(hashPayload({ a: 1, b: { c: 1 } })).not.toBe(hashPayload({ a: 1, b: { c: 2 } }))
  })
})

describe('receipt chaining', () => {
  it('links each receipt to the previous one and verifies intact chains', () => {
    const guard = createGuard([noDelete], { chain: true })
    const receipts = [
      guard({ type: 'email.send', payload: { n: 1 } }).receipt,
      guard({ type: 'email.send', payload: { n: 2 } }).receipt,
      guard({ type: 'record.delete', payload: { n: 3 } }).receipt,
    ]

    expect(receipts[0]!.prev_receipt_hash).toBeUndefined()
    expect(receipts[1]!.prev_receipt_hash).toBe(hashReceipt(receipts[0]!))
    expect(verifyChain(receipts)).toBe(-1)
  })

  it('detects tampering anywhere in the chain', () => {
    const guard = createGuard([noDelete], { chain: true })
    const receipts = [
      guard({ type: 'email.send', payload: { n: 1 } }).receipt,
      guard({ type: 'email.send', payload: { n: 2 } }).receipt,
      guard({ type: 'email.send', payload: { n: 3 } }).receipt,
    ]

    receipts[1] = { ...receipts[1]!, allowed: false }
    expect(verifyChain(receipts)).toBe(2)
  })
})
