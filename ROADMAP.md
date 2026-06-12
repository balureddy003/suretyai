# Surety AI — Roadmap

> **Vision:** Surety is the open trust layer for autonomous agents: every consequential action passes through deterministic gates, earns or spends trust, stays inside hard budget breakers, and leaves a tamper-evident receipt that links decision → cost → outcome. Agents graduate from supervised to autonomous the same way employees do — **by track record, never by vibes.**

Authorization for agents is a solved race (OPA, Cedar, platform toolkits). Surety deliberately occupies the layer above it: **graduated trust and accountability** — how agents *earn* autonomy and *prove* their actions paid off.

## Phase 0 — Make it real ✅ (in progress)

- [x] Standalone, zero-dependency TypeScript core (`createGuard`, rules, receipts)
- [x] Canonical JSON (RFC 8785-aligned) payload hashing — nested-key safe
- [x] Bond limits: daily action and spend circuit breakers (integer minor units)
- [x] Tamper-evident receipt chaining + `verifyChain`
- [x] Action Receipt v0.1 specification (spec/action-receipt.md)
- [x] Test suite and CI
- [ ] Publish `suretyai` v0.1.0 to npm
- [ ] Runnable example: gating a toy agent's tools in under 30 lines

## Phase 1 — The differentiators (months 1–3)

- [ ] **Trust levels** — graduated autonomy: actions auto-approve only after N human approvals at the current level; demotion on rejection
- [ ] **Approval gates** — async human-in-the-loop with pluggable channels (webhook, CLI prompt, Slack)
- [ ] **Approval-signal health** — detect rubber-stamping (rapid-fire approvals, no-variance, batch spikes) and pause trust graduation when oversight degrades
- [ ] **Adapters**, in order of leverage:
  - [ ] MCP middleware — wrap any MCP server in a guard
  - [ ] Claude Agent SDK (PreToolUse hook)
  - [ ] LangGraph / LangChain
  - [ ] OpenAI Agents SDK
- [ ] Pluggable policy backends — accept OPA/Cedar decisions, emit Action Receipts for them

## Phase 2 — Become a standard, not a library (months 3–9)

- [ ] **Python port** (`suretyai` on PyPI) with API parity
- [ ] Action Receipt v0.2: signatures, trust/approval fields, cost→outcome linkage
- [ ] Interop: emit OAP-compatible signed audit records
- [ ] Map controls to the OWASP Agentic Top 10
- [ ] Engage the NIST AI Agent Standards Initiative
- [ ] Reproducible benchmark: adversarial bypass rate with/without Surety, plus approval-load reduction as trust graduates

## Phase 3 — Ecosystem (months 9–18)

- [ ] Community rule packs: payments, email, CRM, infra (versioned, signed)
- [ ] Receipt store integrations (Postgres, SQLite, S3 append-only)
- [ ] Neutral governance: co-maintainers, contribution ladder; explore donating the **spec** to a neutral body
- [ ] Commercial layer (separate): hosted control room, calibration, causal outcome attribution over receipt streams

## Non-goals

- Content guardrails (prompt-injection, toxicity) — use LlamaFirewall / NeMo Guardrails alongside Surety
- A new policy language — Rego and Cedar exist; Surety wraps them
- LLM-evaluated gates — an LLM may *propose*; only deterministic rules *allow*
