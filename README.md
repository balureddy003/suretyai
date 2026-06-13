<div align="center">

# Surety AI

### Probabilistic agents. Verified actions.

**The open execution boundary for autonomous AI agents.**
Agents may hallucinate; execution does not have to. Surety puts deterministic
gates, hard exposure limits, and tamper-evident receipts between an agent's
proposal and the real world.

[![CI](https://github.com/balureddy003/suretyai/actions/workflows/ci.yml/badge.svg)](https://github.com/balureddy003/suretyai/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-0066cc)](LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Python >= 3.10](https://img.shields.io/badge/python-%3E%3D3.10-3776ab?logo=python&logoColor=white)](python/)
[![Zero dependencies](https://img.shields.io/badge/runtime%20deps-zero-brightgreen)](package.json)

[**Why**](#why) · [**Quick start**](#quick-start) · [**Earned autonomy**](#earned-autonomy) · [**Works with your stack**](#works-with-your-stack) · [**Evals**](#evals) · [**Production readiness**](#production-readiness) · [**Examples**](examples/) · [**Strategy**](docs/PRODUCT_STRATEGY.md) · [**Architecture**](docs/ARCHITECTURE.md) · [**Spec**](spec/action-receipt.md) · [**Roadmap**](ROADMAP.md)

</div>

---

## Why

In April 2026, a coding agent hit a credential mismatch in staging, found an API token in an unrelated file, and deleted a production database — and its backups — in nine seconds. Its post-incident summary: *"I violated every principle I was given."*

Principles stated in a prompt are not controls. The agent ecosystem has content guardrails (is this text safe?) and authorization (is this action permitted?), but almost nothing answers the questions that actually decide blast radius:

- **How much autonomy has this agent *earned*?** Static human-in-the-loop doesn't scale — reviewers drown, then reflexively approve, and "oversight" becomes theater. Approving everything and approving nothing both fail.
- **What evidence does each decision leave?** Post-incident forensics today rely on the agent's own logs — the defendant writes the police report.
- **What stops a runaway loop at 3 a.m.?** A hard ceiling, not a polite instruction.

Surety is that layer. Four invariants, enforced in code:

1. **Rules decide, LLMs propose.** Only deterministic rules allow an action. The same action, policy, and state produce the same decision — there is no prompt to inject.
2. **Trust is earned per action-type.** Agents graduate `SUPERVISED → PROBATIONARY → TRUSTED → BONDED` on track record, and one rejection demotes instantly. An email track record grants nothing for refunds.
3. **Hard limits are hard.** Daily action/spend ceilings in integer minor units. Checked at the gate, committed only after execution.
4. **Every decision leaves a receipt.** Hash-chained, payload-hashed (never payload-stored), verifiable by a third party. [An open spec](spec/action-receipt.md), not a log format.

The next phase closes the loop: require independent evidence for an action's
assumptions, hold unresolved actions against an exposure budget, verify the
real outcome, and grant more autonomy only from verified success. We call this
**outcome-bonded autonomy**. See the
[product strategy](docs/PRODUCT_STRATEGY.md) and [roadmap](ROADMAP.md).

Surety's research direction adds **calibrated foresight** without weakening the
deterministic boundary: forecasting and ML may require simulation, canaries,
approval, or denial, but may never override failed invariants or hard limits.
See [reliability research](docs/RELIABILITY_RESEARCH.md).

## Quick start

```bash
npm install suretyai        # Python: pip install suretyai
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

const result = guard({ type: 'payment.refund', payload: { invoice: 'INV-1042', amount_minor: 9900 } })

result.allowed   // false — deterministically, every time
result.reasons   // ['Refunds above £50.00 require human approval']
result.receipt   // tamper-evident Action Receipt for your audit store
```

## Earned autonomy

The full pipeline adds the trust ledger, human approval gates, and oversight-health monitoring:

```ts
import { ApprovalSignalHealth, TrustLedger, WebhookApprovalGate, createPipeline } from 'suretyai'

const pipeline = createPipeline({
  rules: [limits.rule(), refundCeiling],
  trust: new TrustLedger(),                                  // graduated autonomy
  approval: new WebhookApprovalGate({ url: APPROVALS_URL }), // human-in-the-loop
  health: new ApprovalSignalHealth(),                        // rubber-stamp detection
  limits,
  agent_id: 'billing-agent',
  chain: true,
})

const result = await pipeline.run(action)
// decision: 'auto_approved' | 'gate_approved' | 'gate_rejected' | 'gate_timeout' | 'policy_blocked'
if (result.allowed) { await execute(action); limits.record(action) }
```

What that buys you, measured ([run it yourself](examples/02-earned-autonomy.ts)):

| | Static HITL | No HITL | **Surety graduated trust** |
|---|---|---|---|
| Human decisions per 100 routine actions | 100 | 0 | **30, falling toward 0** |
| Rogue action stopped before execution | ✅ (if reviewer awake) | ❌ | ✅ rules + gate + limits |
| Reviewer fatigue → reflexive approval | guaranteed at scale | n/a | **detected and flagged** |
| Misbehavior consequence | none | none | **instant demotion** |
| Audit trail | app logs | agent's own logs | **hash-chained receipts** |

And trust is asymmetric, like it is with people: ~30 clean approvals to earn autonomy, one rejection to lose it.

## Works with your stack

One guard object; adapters for wherever your agents live. No framework lock-in, no rewrite:

```ts
// MCP — wrap any server's tool dispatcher
const safeTool = mcpGuard(guard, server.tool.bind(server))

// Claude Agent SDK — PreToolUse hook, sync, ~zero latency
const hook = claudePreToolUse(guard)

// OpenAI Agents SDK — input guardrail
new Agent({ inputGuardrails: [openaiGuardrail(guard)] })

// Kairos — implement its PolicyProvider execution boundary
const policyProvider = createKairosPolicyProvider({
  on_receipt: receipt => receiptStore.save(receipt),
})
```

Composes with — never replaces — the rest of the safety stack: content guardrails (LlamaFirewall, NeMo Guardrails) above, policy engines (OPA, Cedar) alongside. See [where Surety sits](docs/ARCHITECTURE.md#1-where-surety-sits-in-the-stack).

Surety is also the planned replacement for the standalone `kairos-guard`
package. See the [Kairos migration guide](docs/KAIROS_MIGRATION.md).

## Evals

Every claim above is backed by a reproducible eval — CI runs them on every push, so the README can't drift from the code. Reproduce with `npm run eval`:

| # | Claim | Result |
|---|---|---|
| E1 | Included adversarial corpus: case spoofing, string smuggling, type spoofing, credential laundering | **0/10 bypassed** |
| E2 | Included canonicalization and collision cases (incl. the nested-key collision class — [spec §3](spec/action-receipt.md)) | **6/6 correct** |
| E3 | Graduated trust vs static HITL, 200 routine actions | **85% fewer human decisions** |
| E4 | Oversight-health monitor: 4 rubber-stamp patterns + 1 healthy reviewer | **5/5 classified correctly** |

Details and methodology: [evals/](evals/).

The eval suite also includes a seeded
[comparative simulation](evals/SIMULATION_RESULTS.md) that replays one labeled
refund-action stream through unguarded execution, static HITL, and the real
Surety guard. It reports both prevented loss and residual risk. Simulation
validates mechanisms and hypotheses; field claims require independently labeled
Kairos historical or shadow-mode traces.

## Examples

Five runnable demos, no API keys needed — including [the PocketOS incident replayed against Surety](examples/03-pocketos-incident.ts) (3/3 destructive steps blocked, routine work unimpeded) and [an agent earning its autonomy in 60 seconds](examples/02-earned-autonomy.ts). Index: [examples/](examples/).

**This repo dogfoods itself:** the CI research agent runs under a Surety guard via a Claude Code `PreToolUse` hook — pushes to main blocked, workflow self-edits blocked, every tool call receipted ([scripts/surety-hook.mjs](scripts/surety-hook.mjs)).

## Project status

`v0.2` — core pipeline (guard, trust, gates, health, limits, receipts) shipped in TypeScript and Python with 80+ tests and the eval suite; MCP/Claude/OpenAI adapters shipped. Pre-1.0: API may still move; the [Action Receipt spec](spec/action-receipt.md) is versioned independently. See the [roadmap](ROADMAP.md) for what's next (receipt persistence, Slack gate, crewAI/LangGraph/pydantic-ai adapters, signed receipts).

## Production readiness

Read this before putting Surety on a real money path — we'd rather you know the edges than discover them.

**Ready now**
- The deterministic guard, bond-limit *checks*, canonical hashing, and receipt chaining are pure and side-effect-free — safe to run inline on a hot path.
- TS and Python cores are at parity for guard / trust / limits / health; the full async pipeline and approval gates are TypeScript-only today.

**Not ready yet — design around these**
- **State is in-memory and single-process.** `TrustLedger`, `BondLimits`, `ApprovalSignalHealth`, and the receipt chain live in process memory. Across concurrent workers or replicas you get *per-process* trust and limits — two workers can each approve up to the "daily" ceiling, and trust earned on one isn't seen by another. For now, run one guard instance behind a queue, or persist/reload manually via `TrustLedger.export()/from()`. Durable Postgres/Redis backends with atomic limits are the headline of [Phase 2](ROADMAP.md).
- **Budget commit is the caller's job.** The pipeline *checks* limits but does not record them; call `limits.record(action)` after a successful execution or ceilings won't enforce (see [examples/02](examples/02-earned-autonomy.ts)).
- **Approval is a prediction, not proof.** Trust graduates on approvals; close the loop with `trust.recordOutcome(success)` so an approved-but-ineffective agent is demoted. Without outcome reporting, "trusted" means "approved," not "worked."
- **The bundled evals are internal simulations**, not field evidence — they prove the code behaves as specified on synthetic workloads (the simulation deliberately leaves an `ambiguous_intent` class unblocked). Validate against your own traces before trusting the numbers.

In short: today Surety is production-ready as a **single-instance** decision boundary with manual state persistence. Distributed, durable, atomic state is next.

## Documentation

| | |
|---|---|
| [Architecture & design decisions](docs/ARCHITECTURE.md) | The stack position, pipeline, and 11 design decisions with rationale |
| [Reliability research](docs/RELIABILITY_RESEARCH.md) | Deterministic assurance informed by calibrated forecasting and ML |
| [Kairos migration guide](docs/KAIROS_MIGRATION.md) | Replace `kairos-guard` without duplicating Kairos outcome contracts |
| [Action Receipt spec v0.1](spec/action-receipt.md) | The vendor-neutral receipt format — implement it without Surety |
| [Examples](examples/) · [Evals](evals/) | Runnable demos and reproducible measurements |
| [Roadmap](ROADMAP.md) | Phased plan with measurable exit criteria |
| [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) | How to help, how to report |

## License

[Apache-2.0](LICENSE) — including its explicit patent grant: everything here is freely usable, forever.
