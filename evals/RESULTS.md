# Surety AI — Evaluation Results

> Reproduce with `npm run eval`. Generated 2026-06-12 on suretyai 0.2.0.

| # | Evaluation | Measurement | Result | Status |
|---|---|---|---|---|
| E1 | Adversarial bypass rate | 0/10 bypassed | **0.0%** | ✅ |
| E2 | Hash integrity (canonicalization) | 6/6 cases correct | **no collisions** | ✅ |
| E3 | Approval-load reduction (200 routine actions) | 30 human decisions vs 200 static-HITL | **85% reduction** | ✅ |
| E4 | Degraded-oversight detection | 5/5 scenarios classified correctly | **all detected, no false positive** | ✅ |

## What each eval demonstrates

- **E1 — Adversarial bypass.** Deterministic rules have no prompt surface to inject into: case-spoofing, string smuggling, payload type-spoofing, and credential laundering all fail. This is the structural difference from LLM-judged gates.
- **E2 — Hash integrity.** Receipt hashes are canonical-JSON based: key-order invariant, nested-collision resistant (the `JSON.stringify` replacer-array bug class is specifically covered), type-confusion resistant.
- **E3 — Approval-load reduction.** The economic argument for graduated trust: human review effort concentrates on the probation period instead of scaling linearly forever. Static HITL costs n decisions for n actions; earned autonomy costs ~the graduation threshold.
- **E4 — Oversight health.** Human approval is only a safety signal while humans are actually deciding. All four documented rubber-stamping patterns are flagged; an engaged reviewer is not.
