import { describe, expect, it } from 'vitest'
import { canonicalize } from './canonical.js'

describe('canonicalize', () => {
  it('is invariant to top-level key order', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }))
  })

  it('is invariant to nested key order', () => {
    expect(canonicalize({ x: { b: 1, a: 2 } })).toBe(canonicalize({ x: { a: 2, b: 1 } }))
  })

  it('never drops nested keys absent from the top level', () => {
    // Regression: a JSON.stringify replacer-array acts as a global key
    // allow-list and silently drops nested keys. Canonical serialization
    // must include every nested field.
    const a = canonicalize({ a: 2, b: { c: 1 } })
    const b = canonicalize({ a: 2, b: { c: 999 } })
    expect(a).toContain('"c"')
    expect(a).not.toBe(b)
  })

  it('serializes arrays in order, with undefined elements as null', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]')
    expect(canonicalize([1, undefined, 2])).toBe('[1,null,2]')
  })

  it('omits undefined object values like JSON.stringify', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}')
  })

  it('handles primitives and escapes strings', () => {
    expect(canonicalize(null)).toBe('null')
    expect(canonicalize(true)).toBe('true')
    expect(canonicalize(42.5)).toBe('42.5')
    expect(canonicalize('he said "hi"')).toBe('"he said \\"hi\\""')
  })

  it('throws on non-finite numbers', () => {
    expect(() => canonicalize(Infinity)).toThrow(TypeError)
    expect(() => canonicalize(NaN)).toThrow(TypeError)
  })

  it('throws on functions and symbols', () => {
    expect(() => canonicalize(() => 1)).toThrow(TypeError)
    expect(() => canonicalize(Symbol('x'))).toThrow(TypeError)
  })
})
