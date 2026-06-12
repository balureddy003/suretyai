# Evals

Reproducible measurements behind the project's claims. Run locally:

```bash
npm run eval
```

| # | Claim under test | Method |
|---|---|---|
| E1 | Deterministic gates can't be talked past | 10-case adversarial corpus (case spoofing, string smuggling, type spoofing, credential laundering) vs a standard ruleset — bypass rate must be 0% |
| E2 | Receipts can't collide or be forged | Canonicalization property tests incl. the nested-key collision class documented in [spec §3](../spec/action-receipt.md) |
| E3 | Graduated trust beats static HITL economically | 200 routine actions: human decisions needed with a TrustLedger vs without — reduction must exceed 70% |
| E4 | The health monitor guards the guards | 4 rubber-stamping patterns must flag; 1 healthy-reviewer pattern must not |

Results are written to [RESULTS.md](RESULTS.md). CI runs the suite on every push — a failing eval fails the build, so the README's claims can't silently drift from the code.

Planned (roadmap Phase 2): an agentic red-team eval — an LLM actively tries to construct bypassing actions against a live pipeline, in the style of the OAP social-engineering benchmark.
