<div align="center">

# Surety AI

### Bonded agents for the autonomous era

**The open trust layer for autonomous AI agents.**
Every consequential action passes through deterministic gates, stays inside hard budget breakers, and leaves a tamper-evident receipt. Agents graduate from supervised to autonomous the same way employees do — **by track record, never by vibes.**

[![CI](https://github.com/balureddy003/suretyai/actions/workflows/ci.yml/badge.svg)](https://github.com/balureddy003/suretyai/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-0066cc)](LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)

[**Why**](#why) · [**Quick start**](#quick-start) · [**Action Receipts**](#action-receipts) · [**Bond limits**](#bond-limits) · [**How Surety fits the stack**](#how-surety-fits-the-stack) · [**Research & Strategy**](docs/RESEARCH.md) · [**Roadmap**](ROADMAP.md) · [**Spec**](spec/action-receipt.md)

</div>

---

## Why

Agent deployments are outpacing agent governance. The existing open-source layers solve *content* safety (prompt injection, toxicity) and *authorization* (is this action permitted?). Almost nothing solves what comes next:

- **How much should we trust this agent *right now*?** Static human-in-the-loop doesn't scale; approval fatigue is the next crisis. Trust should be *earned* — graduated autonomy backed by track record.
- **What evidence does each decision leave behind?** "The agent did something" is not an audit trail. Every gate decision should produce a portable, tamper-evident receipt.
- **What stops a misaligned agent at 3 a.m.?** Hard, deterministic budget breakers — not a prompt asking it nicely.

Surety's invariants:

1. **Rules decide, LLMs propose.** An LLM may suggest an action; only deterministic rules allow it. The same action always produces the same decision.
2. **Every decision leaves a receipt.** Hash of the payload, never the payload — receipts are safe to ship anywhere.
3. **Hard limits are hard.** Daily action and spend ceilings (integer minor units, no floating-point money) that no prompt can talk its way past.
4. **History is tamper-evident.** Receipts chain by hash; insertion, deletion, or edits are detectable.

## Quick start

```bash
npm install suretyai
```

```ts
import { BondLimits, createGuard } from 'suretyai'

const limits = new BondLimits({ max_actions_per_day: 100, max_spend_per_day_minor: 10_000 })

const guard = createGuard(
  [
    limits.rule(),
    {
      id: 'refund-ceiling',
      check: (a) => a.type !== 'payment.refund' || (a.payload.amount_minor as number) <= 5000,
      reason: 'Refunds above £50.00 require human approval',
    },
  ],
  { agent_id: 'billing-agent', chain: true }
)

// The agent proposes; the guard decides — deterministically.
const result = guard({ type: 'payment.refund', payload: { invoice: 'INV-1042', amount_minor: 9900 } })

result.allowed       // false
result.reasons       // ['Refunds above £50.00 require human approval']
result.receipt       // tamper-evident Action Receipt for your audit store

if (result.allowed) {
  // await execute(action)
  limits.record(action) // budget commits only after execution
}
```

Run the full example: `npx tsx examples/basic.ts`

## Action Receipts

Every decision — allowed or blocked — produces an [Action Receipt](spec/action-receipt.md), an open, vendor-neutral audit record:

```json
{
  "id": "0d5c1f1e-7a2b-4d4e-9c64-1b6c9b9b2f10",
  "spec": "action-receipt/v0.1",
  "agent_id": "billing-agent",
  "action_type": "payment.refund",
  "payload_hash": "9f86d081…",
  "timestamp": "2026-06-10T14:23:05.118Z",
  "allowed": false,
  "failed_rules": ["refund-ceiling"],
  "outcome": "policy_blocked",
  "prev_receipt_hash": "2c26b46b…"
}
```

Payloads are hashed with canonical JSON (RFC 8785-aligned, recursive key sorting — nested fields can never silently vanish from the hash). With `chain: true`, each receipt carries the hash of the one before it; `verifyChain(receipts)` proves the history is intact.

## Bond limits

A *surety bond* guarantees performance — so do bond limits. They are hard daily circuit breakers, checked at gate time and committed only after execution, so blocked actions never consume budget:

```ts
const limits = new BondLimits({
  max_actions_per_day: 50,
  max_spend_per_day_minor: 25_000, // £250.00 — always integer minor units
})
```

## How Surety fits the stack

| Layer | Question it answers | Projects | Surety's relationship |
|---|---|---|---|
| Content guardrails | "Is this text safe?" | LlamaFirewall, NeMo Guardrails, Guardrails AI | Complementary — run both |
| Authorization | "Is this action permitted?" | OPA/Rego, Cedar, platform toolkits | Complementary — Surety can wrap their decisions in receipts |
| **Trust & accountability** | **"How much autonomy has this agent earned, and what evidence does each action leave?"** | **Surety** | This layer |

Coming next (see the [roadmap](ROADMAP.md)): trust levels with graduated auto-approval, human approval gates, rubber-stamp detection, and adapters for MCP, the Claude Agent SDK, LangGraph, and the OpenAI Agents SDK — plus a Python port.

## Provenance

Surety began as `kairos-guard`, the safety firewall inside the [Kairos](https://github.com/kairos-ai) deterministic intelligence platform, extracted and rebuilt as a standalone, zero-dependency library with an open specification.

## License

[Apache-2.0](LICENSE) — including its explicit patent grant: anything in this repository is freely usable, forever.
