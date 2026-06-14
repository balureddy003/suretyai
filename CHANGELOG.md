# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] — 2026-06-13

### Changed
- Renamed npm package to `@suretyainpm/suretyai` to match the scoped access token.

### Fixed
- PyPI publish workflow switched from OIDC trusted publishing to API token auth (`secrets.pypi`).

## [0.2.0] — 2026-06-12

### Added
- **TrustLedger** — graduated autonomy per `(agent_id, action_type)`: SUPERVISED → PROBATIONARY → TRUSTED → BONDED; instant demotion on rejection; serializable state.
- **Approval gates** — pluggable async human-in-the-loop: Console, Webhook, Memory.
- **ApprovalSignalHealth** — rubber-stamp detection (`rapid_fire`, `batch_approval`, `no_variance`, `dismiss_spike`).
- **Pipeline** — orchestrates rules → trust → gate → health → receipt in one `await pipeline.run(action)`; fails closed when misconfigured.
- **Adapters**: MCP (`wrapToolHandler`/`mcpGuard`), Claude Agent SDK (`claudePreToolUse`), OpenAI Agents SDK (`openaiGuardrail`).
- **Python parity** — guard, trust, limits, health modules with 38 tests.
- Runnable examples including PocketOS-incident replay and earned-autonomy demo.
- Eval suite with reproducible numbers: 0% adversarial bypass, 0 hash collisions, 85% approval-load reduction, 5/5 oversight-health classification.
- Dogfooding: CI agent runs under a Surety guard via Claude Code `PreToolUse` hook.

## [0.1.0] — 2026-06-10

### Added
- Standalone, zero-dependency TypeScript core (`createGuard`, rules, receipts).
- Canonical JSON (RFC 8785-aligned) payload hashing — nested-key safe.
- Bond limits: daily action and spend circuit breakers (integer minor units).
- Tamper-evident receipt chaining + `verifyChain`.
- Action Receipt v0.1 specification.
- Test suite and CI (Node 20/22, Python 3.10–3.12).
