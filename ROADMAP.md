# Surety AI — Roadmap

> **Vision:** Surety is the open trust layer for autonomous agents: every consequential action passes through deterministic gates, earns or spends trust, stays inside hard budget breakers, and leaves a tamper-evident receipt that links decision → cost → outcome. Agents graduate from supervised to autonomous the same way employees do — **by track record, never by vibes.**

Authorization for agents is a solved race (OPA, Cedar, platform toolkits). Surety deliberately occupies the layer above it: **graduated trust and accountability** — how agents *earn* autonomy and *prove* their actions paid off.

## Phase 0 — Make it real ✅ shipped

- [x] Standalone, zero-dependency TypeScript core (`createGuard`, rules, receipts)
- [x] Canonical JSON (RFC 8785-aligned) payload hashing — nested-key safe
- [x] Bond limits: daily action and spend circuit breakers (integer minor units)
- [x] Tamper-evident receipt chaining + `verifyChain`
- [x] Action Receipt v0.1 specification ([spec/action-receipt.md](spec/action-receipt.md))
- [x] Test suite and CI (Node 20/22, Python 3.10–3.12)

## Phase 1 — The differentiators ✅ shipped

- [x] **TrustLedger** — graduated autonomy per (agent, action_type): SUPERVISED → PROBATIONARY → TRUSTED → BONDED; instant demotion on rejection; serializable state
- [x] **Approval gates** — pluggable async human-in-the-loop: Console, Webhook, Memory
- [x] **ApprovalSignalHealth** — rubber-stamp detection (rapid_fire, batch_approval, no_variance, dismiss_spike)
- [x] **Pipeline** — rules → trust → gate → health → receipt in one `await pipeline.run(action)`; fails closed when misconfigured
- [x] **Adapters**: MCP (`wrapToolHandler`/`mcpGuard`), Claude Agent SDK (`claudePreToolUse`), OpenAI Agents SDK (`openaiGuardrail`)
- [x] **Python parity** (trust + health; 35 tests)

## Phase 1.5 — Credibility & distribution 🔶 in progress

- [x] Runnable examples incl. the PocketOS-incident replay and the earned-autonomy demo ([examples/](examples/))
- [x] **Eval suite** with reproducible numbers: 0% adversarial bypass, 0 hash collisions, 85% approval-load reduction, 5/5 oversight-health classification ([evals/](evals/))
- [x] Dogfooding: this repo's CI agent runs under a Surety guard (PreToolUse hook, receipted)
- [ ] Publish v0.2.0 to npm + PyPI (one manual bootstrap publish unblocks CI publishing)
- [ ] Receipt persistence interfaces: SQLite + JSONL append-only stores
- [ ] Python pipeline + approval-gate parity (currently TS-only)

## Phase 2 — Standard, not library (months 1–6)

- [ ] Action Receipt v0.2: Ed25519 signatures, trust-level + approval fields, cost→outcome linkage
- [ ] Formal response to the NIST NCCoE agent identity & authorization concept paper (cite the working implementation)
- [ ] Python adapters: crewAI, LangGraph, pydantic-ai
- [ ] Slack approval gate (the one enterprises actually use)
- [ ] Trust-state persistence: Postgres/Redis backends
- [ ] OPA/Cedar bridge: wrap external authz decisions in receipts
- [ ] Agentic red-team eval: an LLM actively constructs bypass attempts against a live pipeline
- **Exit criteria:** 3 external projects emitting Action Receipts; 1,000 combined weekly downloads

## Phase 3 — Ecosystem (months 6–18)

- [ ] Community rule packs: payments, email, infra, CRM (versioned, signed)
- [ ] Multi-instance trust federation (shared ledger across agent fleets)
- [ ] EU AI Act Article 14 compliance-export tooling (oversight evidence on demand)
- [ ] Neutral spec governance: co-maintainers; explore donating the **spec** to a neutral body
- [ ] Commercial control plane (separate project) consuming the open receipt stream
- **Exit criteria:** an agent framework ships a built-in Surety integration; the spec is referenced in a standards document

## Non-goals, permanently

Content filtering (compose with LlamaFirewall/NeMo) · policy languages (wrap Rego/Cedar) · agent orchestration · **LLM-evaluated gates** — an LLM may propose; only deterministic rules allow.
