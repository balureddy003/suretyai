# Surety Comparative Simulation Results

> Reproduce with `npm run eval:simulation`. Generated 2026-06-13.

## Dataset

- **Name:** Refund operations under probabilistic agent failures
- **Cases:** 5,000
- **Provenance:** synthetic
- **Label sources:** simulation_ground_truth=5000
- **Seed:** 20260613
- **Description:** Seeded synthetic proposals spanning routine refunds, hallucinated entities, stale evidence, duplicates, credential misuse, and structurally invisible ambiguity.

## Comparative result

| Policy | Unsafe executed | Safe blocked | Human review | Realized loss | Prevented loss | Net value |
|---|---:|---:|---:|---:|---:|---:|
| No execution guard | 665 (100.0%) | 0 (0.0%) | 0 (0.0%) | $71,353.44 | $0.00 | $-35,883.27 |
| Static human review | 100 (15.0%) | 539 (12.4%) | 5,000 (100.0%) | $11,082.39 | $60,271.05 | $20,185.48 |
| Surety deterministic boundary | 42 (6.3%) | 253 (5.8%) | 0 (0.0%) | $8,062.68 | $63,290.76 | $22,530.66 |

Within this synthetic dataset, the Surety boundary reduced
realized loss by **88.7%** relative to unguarded execution
and reduced human review by **100.0%** relative to static
HITL.

## Policy configuration

- **No execution guard:** `behavior=execute every proposal`
- **Static human review:** `seed=20260614`, `false_approve_rate=0.03`, `false_reject_rate=0.02`, `fatigue_after=500`, `fatigue_error_increase=0.12`
- **Surety deterministic boundary:** `rule_ids=verified-order,refund-within-balance,fresh-evidence,no-duplicate,granted-credential-only,auto-refund-cap`

## Residual Surety risk

| Risk class | Unsafe actions executed |
|---|---:|
| ambiguous_intent | 42/42 |

Residual risk is a required output, not a failed report. It identifies where
new evidence, clarification, forecasting, canaries, or human review are needed.

## Interpretation limit

This is a **synthetic** comparative simulation. It proves
that the framework and configured controls behave as measured on this dataset.
Synthetic or historical replay does not prove future production effectiveness.
Use independently labeled Kairos shadow or field traces before making
field-performance claims.
