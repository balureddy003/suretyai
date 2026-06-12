/**
 * Canonical JSON serialization, aligned with RFC 8785 (JCS) for the
 * JSON subset Surety produces: object keys are sorted recursively by
 * UTF-16 code units, so semantically identical values always serialize —
 * and therefore hash — identically, regardless of key insertion order
 * or nesting depth.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Cannot canonicalize non-finite number')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    // JSON.stringify serializes undefined array elements as null; match that.
    return '[' + value.map((v) => canonicalize(v === undefined ? null : v)).join(',') + ']'
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + canonicalize(v)).join(',') + '}'
  }
  throw new TypeError(`Cannot canonicalize value of type ${typeof value}`)
}
