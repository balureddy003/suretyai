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

## Comparative simulation

Run the counterfactual simulation separately:

```bash
npm run eval:simulation
```

The same labeled action stream is replayed through:

1. unguarded execution;
2. static human review with configurable error and fatigue assumptions;
3. the real Surety deterministic guard.

The report measures unsafe executions, safe actions blocked, review load,
realized loss, prevented loss, retained value, and residual risk by failure
class. Results are written to
[SIMULATION_RESULTS.md](SIMULATION_RESULTS.md) and
[SIMULATION_RESULTS.json](SIMULATION_RESULTS.json).

The included refund workload is seeded synthetic data. It deliberately contains
an `ambiguous_intent` class that passes structural checks, demonstrating where
Surety needs stronger evidence, clarification, forecasting, or review.

### Replacing synthetic data with your own traces

The replay engine accepts any `SimulationDataset`. Use
`parseJsonlDataset()` for exports where each line contains:

```json
{
  "id": "action-123",
  "action": { "type": "payment.refund", "payload": { "amount_minor": 2500 } },
  "expected": "safe",
  "risk_class": "routine_safe",
  "label_source": "verified_outcome",
  "source_ref": "provider-receipt-123",
  "loss_if_executed_minor": 0,
  "value_if_executed_minor": 500
}
```

For credible field evaluation, derive `expected` and economic values from
provider receipts and verified outcomes, not from the agent or an LLM judge.
Set dataset provenance to `historical`, `shadow`, or `field`, and run the same
cases through the baseline and candidate policies.

For labeled refund traces, the built-in runner accepts JSONL directly:

```bash
npm run eval:simulation -- --input ./refunds.jsonl --provenance shadow
```
