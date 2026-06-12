# Contributing to Surety AI

Thanks for helping build the trust layer for autonomous agents.

## Ground rules (the invariants)

PRs that violate these will be declined regardless of quality — they're the product:

1. **Zero runtime dependencies.** The TypeScript and Python cores stay dependency-free. Dev dependencies are fine; runtime ones are not — a safety layer must not widen the supply-chain attack surface it exists to reduce.
2. **Rules stay deterministic.** No LLM call may ever decide an `allowed: true`. An LLM may propose; only deterministic rules allow.
3. **Fail closed.** Any ambiguous or misconfigured path blocks, never silently allows.
4. **Money is integer minor units.** No floats, ever.
5. **TS/Python parity.** Features land in both languages (or the PR states the parity plan).

## Dev loop

```bash
npm install
npm run typecheck && npm test     # 45 TS tests
npm run eval                      # reproducible claims — must stay green
npm run examples                  # all five demos must run clean

cd python && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/pytest                  # 35 Python tests
```

CI runs all of the above on Node 20/22 and Python 3.10–3.12.

## What's most useful right now

See the [roadmap](ROADMAP.md) — Phase 1.5/2 items are the sweet spot: receipt persistence stores, the Slack approval gate, Python pipeline parity, and crewAI/LangGraph/pydantic-ai adapters. For spec changes ([spec/action-receipt.md](spec/action-receipt.md)), open an issue first — the spec is versioned independently and other implementers may depend on it.

## Conduct

Be excellent to each other. Security reports go to [SECURITY.md](SECURITY.md), not public issues.
