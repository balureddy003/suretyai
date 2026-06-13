# Surety AI — Architecture & Design

> How Surety fits the agent-safety stack, how the pipeline works, and the design decisions behind it — with rationale.

## 1. Where Surety sits in the stack

```
┌──────────────────────────────────────────────────────────────┐
│  Agent frameworks (crewAI, LangGraph, pydantic-ai, SDKs)     │
├──────────────────────────────────────────────────────────────┤
│  CONTENT layer       "Is this text safe?"                    │
│  LlamaFirewall · NeMo Guardrails · Guardrails AI             │
├──────────────────────────────────────────────────────────────┤
│  AUTHORIZATION layer "Is this action permitted?"             │
│  OPA/Rego · Cedar · platform governance toolkits             │
├──────────────────────────────────────────────────────────────┤
│  TRUST & ACCOUNTABILITY layer                                │
│  "How much autonomy has this agent EARNED,                   │
│   and what evidence does each action leave?"                 │
│  ◆ SURETY AI ◆                                               │
├──────────────────────────────────────────────────────────────┤
│  Execution (tools, MCP servers, APIs, infrastructure)        │
└──────────────────────────────────────────────────────────────┘
```

Authorization answers a static question; trust answers a dynamic one. A policy says the billing agent *may* issue refunds under £50. Surety says it may do so *autonomously* only after 30 clean approvals, will lose that autonomy on its first rejection, can never exceed £250/day regardless, and every decision is receipted. **Complementary by design** — Surety can wrap an OPA/Cedar decision and add the trust dial plus the receipt.

## 2. The pipeline

```
                     agent proposes action
                              │
                              ▼
              ┌─ suretyai pipeline.run(action) ─────────────────┐
              │                                                  │
              │  1. RULES (deterministic, sync, no LLM)          │
              │     GuardRule[] + BondLimits.rule()              │
              │       └─ fail → policy_blocked + receipt         │
              │                                                  │
              │  2. TRUST lookup (agent_id × action_type)        │
              │       └─ ≥ auto_approve_from → auto_approved     │
              │                                                  │
              │  3. APPROVAL GATE (async, pluggable)             │
              │     Console │ Webhook │ Memory │ (Slack…)        │
              │       └─ decision → TrustLedger.record()         │
              │       └─ decision → ApprovalSignalHealth.record()│
              │                                                  │
              │  4. RECEIPT (always, hash-chained)               │
              │     ActionReceipt v0.1 → audit store             │
              └──────────────────────────────────────────────────┘
                              │
               allowed ──► execute ──► limits.record(action)
```

**Module map (TypeScript + Python parity):** `canonical` (RFC 8785-aligned hashing) · `guard` (rules → receipt) · `limits` (circuit breakers) · `trust` (graduated ledger) · `approval` (gate interface + 3 implementations) · `health` (rubber-stamp detection) · `pipeline` (orchestration) · `adapters/{mcp,claude,openai,kairos}`.

## 3. Design decisions, with rationale

| Decision | Rationale |
|---|---|
| **Zero runtime dependencies** | A safety layer must not widen the supply-chain attack surface it exists to reduce. Auditable in one sitting. |
| **Sync core, async edges** | The deterministic guard adds ~0 latency; only human gates are async. No performance excuse to bypass safety. |
| **Trust is per (agent, action_type)** | Privilege earned sending emails must never transfer to issuing refunds. |
| **Demotion is instant, graduation is slow** | Trust asymmetry mirrors human institutions; one rejection costs a level, recovery requires a fresh streak. |
| **Budget commits after execution, not at gate** | Blocked/abandoned actions must not consume budget; double-spend on retry is the safer failure. |
| **Integer minor units for money** | Floating-point money in a safety system is malpractice. |
| **Receipts hash payloads, never store them** | Safe to ship to third-party audit stores; privacy by construction. |
| **Canonical JSON, never replacer-array hashing** | The naive `JSON.stringify(v, sortedKeys)` approach silently drops nested keys → hash collisions. Spec §3 documents the trap. |
| **Block-by-default when no gate is configured** | A misconfigured pipeline fails closed, never open. |
| **Spec (Action Receipt) separate from brand (Surety)** | Standards get adopted when they sound un-owned. |
| **Never an LLM-evaluated gate** | An LLM may propose; only deterministic rules allow. The same action always produces the same decision. |

## 4. Target architecture: outcome-bonded autonomy

The shipped v0.2 pipeline governs admission. The target architecture closes the
loop around execution:

```
   agent proposes Action Contract
                │
                ▼
   evidence verifiers ──► policy + exposure gate
   · authoritative              │
   · deterministic              ├─ deny / simulate / approve
   · human-attested             ├─ canary / execute
   · probabilistic-advisory     ▼
                            execution
                                │
                                ▼
                       outcome verifiers
                                │
                ┌───────────────┴────────────────┐
                ▼                                ▼
       close outcome receipt          compensate / expire / alert
                │                                │
                └───────────────┬────────────────┘
                                ▼
                  update autonomy + exposure
```

An allowed action remains an unresolved liability until its outcome closes.
Unresolved actions consume an open-loop exposure budget, so an agent cannot
issue an unbounded sequence before failures become visible. Verified outcomes,
not approvals, determine future autonomy.

The open core remains self-sufficient. A commercial control plane can provide
durable distributed state, approval routing, outcome closure, alerts, and audit
exports without making the execution contract proprietary.

### Calibrated foresight

The target architecture separates deterministic assurance from probabilistic
forecasting. Forecasts estimate action failure, expected loss, unsafe-state
reachability, drift, and time to outcome closure. A deterministic mode router
combines them:

```text
final_mode = min(requested_mode, policy_mode, forecast_mode)
```

Because modes are ordered from `deny` through `execute`, forecasting can only
reduce autonomy. It can never override a failed invariant or hard limit. An
expired, missing, drifted, or uncertified forecast falls back to a conservative
mode. See [reliability research](RELIABILITY_RESEARCH.md).

## 5. What Surety is NOT (lane discipline)

- Not a content guardrail (no prompt-injection detection — compose with LlamaFirewall/NeMo)
- Not a policy language (wraps Rego/Cedar, doesn't replace them)
- Not an observability tool (receipts are evidence, not telemetry)
- Not an agent framework (10 lines inside yours, never instead of yours)
- Not a general hallucination detector (it prevents unsupported claims from
  authorizing consequential actions)

## 6. Kairos relationship

Surety replaces the standalone `kairos-guard` package and implements Kairos's
deterministic pre-action `PolicyProvider`. Kairos remains the owner of Outcome
Contracts, KPI evidence, provider execution receipts, and measured outcomes.

This boundary keeps the projects complementary:

```
Kairos Outcome Contract + autonomy policy
                  │
                  ▼
       Surety pre-action decision
                  │
          deny / require approval / allow
                  │
                  ▼
       Kairos capability provider
                  │
                  ▼
       Kairos provider confirmation + outcome evidence
```

See [the migration guide](KAIROS_MIGRATION.md).

## 7. Dogfooding

This repo's own automation is guarded by the library: a Claude Code `PreToolUse` hook ([scripts/surety-hook.mjs](../scripts/surety-hook.mjs), wired via [.claude/settings.json](../.claude/settings.json)) runs every agent tool call through `createGuard` — blocking pushes to main, workflow self-edits, and destructive commands — and appends hash-chained Action Receipts as a tamper-evident audit trail.
