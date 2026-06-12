# Action Receipt Specification — v0.1

**Status:** Draft
**Identifier:** `action-receipt/v0.1`
**Maintained by:** Surety AI (https://github.com/balureddy003/suretyai)
**License:** Apache-2.0

An **Action Receipt** is a tamper-evident record of a gate decision made about an AI agent's action *before* that action executed. Receipts are vendor-neutral: any guard, gateway, or framework may emit them, and any audit system may consume them.

The key words MUST, MUST NOT, SHOULD, and MAY are to be interpreted as described in RFC 2119.

## 1. Design goals

1. **Pre-action** — the receipt records the decision, not just the effect. It MUST be created before the action executes.
2. **Deterministic** — the decision recorded MUST be reproducible from the same action and policy. LLM output MUST NOT be the sole basis for an `allowed: true` decision.
3. **Tamper-evident** — payloads are hashed, and receipts MAY be hash-chained so that alteration or deletion of history is detectable.
4. **Privacy-preserving** — the receipt carries a hash of the action payload, never the payload itself. Receipts are safe to ship to third-party audit stores.

## 2. Receipt fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string (UUID v4) | MUST | Unique identifier of this decision. |
| `spec` | string | MUST | Literal `"action-receipt/v0.1"`. |
| `agent_id` | string | MAY | Identifier of the agent whose action was evaluated. |
| `tenant_id` | string | MAY | Tenant scope in multi-tenant deployments. |
| `action_type` | string | MUST | Namespaced action type, e.g. `email.send`, `payment.refund`. |
| `payload_hash` | string | MUST | SHA-256 hex digest of the canonical JSON serialization (§3) of the action payload. |
| `timestamp` | string | MUST | ISO 8601 time of the decision. |
| `allowed` | boolean | MUST | `true` = the gate allowed the action. |
| `failed_rules` | string[] | MUST | IDs of rules that blocked the action. Empty array when allowed. |
| `outcome` | string | SHOULD | One of `executed`, `policy_blocked`, `dry_run`, `failed`, once known. |
| `outcome_reason` | string | MAY | Human-readable explanation of a block or failure. |
| `dry_run` | boolean | MAY | `true` when the action was simulated. |
| `prev_receipt_hash` | string | MAY | SHA-256 hex digest of the previous receipt (§4). |

Consumers MUST ignore unknown fields, to allow forward-compatible extension.

## 3. Canonical serialization and hashing

Payload and receipt hashes MUST be computed over a canonical JSON serialization aligned with RFC 8785 (JCS) for the JSON subset used here:

1. Object keys are sorted lexicographically by UTF-16 code units, **recursively at every nesting level**.
2. Object members whose value is `undefined`/absent are omitted.
3. Array element order is preserved; `undefined` elements serialize as `null`.
4. No insignificant whitespace.
5. Non-finite numbers are invalid input.

> ⚠️ A `JSON.stringify(value, sortedTopLevelKeys)` replacer-array is **not** a valid implementation: the replacer acts as a global key allow-list and silently drops nested keys, so distinct payloads can collide on the same hash.

The hash is the lowercase hex SHA-256 digest of the UTF-8 bytes of the canonical serialization.

## 4. Receipt chaining

When chaining is enabled, each receipt's `prev_receipt_hash` MUST equal the SHA-256 hex digest of the canonical serialization (§3) of the receipt issued immediately before it by the same guard. The first receipt in a chain omits `prev_receipt_hash`.

A verifier walks the sequence and recomputes each link. Any mismatch proves insertion, deletion, or alteration after the fact.

## 5. Example

```json
{
  "id": "0d5c1f1e-7a2b-4d4e-9c64-1b6c9b9b2f10",
  "spec": "action-receipt/v0.1",
  "agent_id": "billing-agent",
  "action_type": "payment.refund",
  "payload_hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "timestamp": "2026-06-10T14:23:05.118Z",
  "allowed": false,
  "failed_rules": ["refund-ceiling"],
  "outcome": "policy_blocked",
  "prev_receipt_hash": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
}
```

## 6. Relationship to other standards

Action Receipts complement, rather than replace, adjacent layers: authorization policy languages (OPA Rego, Cedar) decide *whether* an action is permitted; MCP gateways decide *where* enforcement happens; Action Receipts standardize *what evidence the decision leaves behind*. Implementations SHOULD emit receipts regardless of which policy engine made the decision.

## 7. Versioning

Breaking changes increment the spec identifier (`action-receipt/v0.2`, …). Additive optional fields do not. Planned for v0.2: cryptographic signatures over receipts, trust-level and approval-gate fields, and cost/outcome linkage (decision → cost → measured result).
