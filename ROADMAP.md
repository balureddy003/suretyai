# Surety AI — Roadmap

> **Vision:** Surety is the open runtime-assurance layer for probabilistic agents:
> every consequential action begins with independently verified evidence, stays
> inside hard exposure limits, and ends with a verified outcome. Agents earn
> autonomy from outcomes, not model confidence or approval clicks.

Authorization, approvals, audit logs, and agent observability are rapidly
becoming platform features. Surety deliberately occupies the missing closed
loop: **what evidence justifies this action now, did it produce the promised
outcome, and what may the agent do next?**

Full market rationale and product thesis:
[docs/PRODUCT_STRATEGY.md](docs/PRODUCT_STRATEGY.md).
Research architecture for calibrated forecasting and ML:
[docs/RELIABILITY_RESEARCH.md](docs/RELIABILITY_RESEARCH.md).

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
- [x] **Python parity** (trust + health; 38 tests)

## Phase 1.5 — Credibility & distribution 🔶 in progress

- [x] Runnable examples incl. the PocketOS-incident replay and the earned-autonomy demo ([examples/](examples/))
- [x] **Eval suite** with reproducible numbers: 0% adversarial bypass, 0 hash collisions, 85% approval-load reduction, 5/5 oversight-health classification ([evals/](evals/))
- [x] Dogfooding: this repo's CI agent runs under a Surety guard (PreToolUse hook, receipted)
- [x] Publish v0.2.1 to npm (`@suretyainpm/suretyai`) + PyPI (`suretyai`) via GitHub Actions
- [ ] Receipt persistence interfaces: SQLite + JSONL append-only stores
- [ ] Python pipeline + approval-gate parity (currently TS-only)

## Phase 2 — Close the loop (months 1–6)

- [ ] **Action Contracts**: typed claims, invariants, expected outcomes,
      exposure, expiry, and compensation plan
- [ ] **Evidence verifiers** with explicit assurance classes: authoritative,
      deterministic, human-attested, and probabilistic-advisory
- [ ] **Execution modes**: deny, simulate, approve, canary, execute
- [ ] **Outcome closure**: independently verify success, failure, compensation,
      or expiry after execution
- [ ] **Open-loop exposure budgets**: cap unresolved action count, financial
      exposure, and time-to-closure
- [ ] **Outcome-based TrustLedger**: conservative reliability bounds scoped to
      contract and environment; reset on material changes
- [ ] Action Receipt v0.2: evidence hashes, policy hash, execution mode,
      outcome attestation, and Ed25519 signatures
- [ ] Durable SQLite/Postgres state with atomic distributed limits
- [ ] First domain pack: Stripe refunds and account credits
- [ ] LangGraph adapter and Slack approval gate
- **Exit criteria:** one design partner demonstrates at least 50% fewer routine
  approvals, more than 95% outcome closure, and no increase in verified
  incorrect actions

## Phase 3 — Prove the wedge (months 6–18)

- [ ] Two additional production domain packs: support credits and
      infrastructure changes
- [ ] Control plane for exposure, outcome closure, approval routing, and alerts
- [ ] OPA/Cedar and agent-identity bridges
- [ ] OpenTelemetry export and compliance-evidence reports
- [ ] Agentic red-team and false-success eval suites
- [ ] Multi-instance trust and exposure federation
- [ ] Publish the production-derived Action Contract and Receipt specifications
      for external implementation
- **Exit criteria:** three paying design partners, 10,000 verified consequential
  actions, and measured reviewer-time or loss reduction

## Research track — Calibrated foresight

Forecasting and ML may only tighten execution modes; they never override failed
invariants, missing evidence, or hard limits. Detailed architecture and
evaluation gates: [docs/RELIABILITY_RESEARCH.md](docs/RELIABILITY_RESEARCH.md).

- [ ] Reliability event schema linking evidence → decision → provider receipt →
      verified outcome
- [ ] Replay harness with versioned policy, feature, and forecast snapshots
- [ ] Beta-Bernoulli lower reliability bounds per scoped action class
- [ ] Drift monitoring that automatically reduces autonomy
- [ ] Forecast certificates with calibration, scope, expiry, and fallback mode
- [ ] Calibrated success, expected-loss, and time-to-closure forecasts
- [ ] Deterministic mode router:
      `min(requested_mode, policy_mode, forecast_mode)`
- [ ] Symbolic trajectory model and unsafe-state reachability forecast
- [ ] Value-of-information clarification and adaptive canary sizing
- [ ] Causal outcome estimation for business-value optimization
- **Research invariant:** an unavailable, expired, drifted, or uncertified
  forecast can never increase autonomy

## Non-goals, permanently

Content filtering · policy languages · agent identity · fleet inventory · agent
orchestration · generic observability · **LLM-only evidence or gates**. Surety
integrates with those layers; it does not replace them.
