# Surety Reliability Research

> Research date: 2026-06-13
>
> Thesis: Surety should make probabilistic agents safer through a deterministic
> assurance plane informed by calibrated forecasting, not by replacing one LLM
> decision with another probabilistic judge.

## Executive conclusion

LLM agents are not unreliable only because they hallucinate facts. Their
failures emerge from the full execution system:

- ambiguous or contradictory intent;
- fabricated, stale, corrupted, or misinterpreted evidence;
- incorrect tool selection or malformed parameters;
- long-horizon planning and compounding errors;
- repeated-action loops and wasted computation;
- environment and tool distribution shift;
- provider failures and uncertain external outcomes;
- incorrect self-evaluation or false claims of success;
- human approval fatigue;
- harness, orchestration, memory, and integration defects.

No single model confidence score captures those risks. Research also shows that
high model accuracy does not imply calibrated uncertainty, self-consistency can
be consistently wrong, LLM judges are biased and unstable, and broader tool
access can reduce reliability by creating unfocused exploration.

Surety therefore needs two separate planes:

1. **Deterministic assurance plane**: decides the maximum execution mode using
   invariants, verified evidence, policy, exposure, idempotency, and lifecycle
   state.
2. **Probabilistic forecasting plane**: estimates future failure, uncertainty,
   drift, and expected outcome from historical verified traces.

The forecasting plane has **one-way authority**:

> A forecast may reduce autonomy, require more evidence, select simulation,
> select a canary, require approval, or deny an action. It may never override a
> failed invariant, missing evidence, or hard limit to grant more autonomy.

This preserves a deterministic execution boundary while allowing Surety to
anticipate risks that static rules cannot enumerate.

## What deterministic means

Surety should not promise that the full agent system becomes deterministic.
Given an LLM, changing data, concurrent tools, and external providers, that
claim would be false.

Surety can make four narrower guarantees:

1. **Deterministic admission:** the same canonical action, verified evidence,
   policy, forecasts, and current exposure snapshot produce the same maximum
   execution mode.
2. **Deterministic constraints:** a failed invariant or exceeded hard limit can
   never be overridden by a model.
3. **Reproducible evidence:** the exact decision inputs, versions, and hashes
   needed to replay admission are receipted.
4. **Bounded uncertainty:** unresolved and forecast-risky actions consume
   explicit exposure budgets.

The distinction matters: Surety does not remove uncertainty. It prevents
uncertainty from silently becoming unlimited authority.

## Failure taxonomy

Surety should collect labels and forecasts at each failure layer rather than
using one generic "agent risk score."

| Layer | Representative failure | Deterministic controls | Forecasting signals |
|---|---|---|---|
| Intent | Ambiguous objective, conflicting constraints | Typed action contract, required fields, clarification policy | Ambiguity and expected value of clarification |
| Evidence | Fabricated entity, stale state, corrupted tool result | Authoritative verifier, expiry, provenance, contradiction rule | Evidence novelty, source reliability, corruption likelihood |
| Planning | Wrong action sequence, unsafe future state | Allowed transition graph, maximum steps, forbidden paths | Unsafe-state reachability, loop probability, recoverability |
| Tool selection | Wrong capability or excessive privilege | Capability allow-list, least privilege, policy | Tool-choice anomaly, historical failure by tool and context |
| Parameters | Wrong amount, recipient, environment, or scope | Schema, ranges, referential integrity, invariants | Outlier and out-of-distribution score |
| Execution | Duplicate, partial, or provider-side failure | Idempotency, atomic limits, provider receipt | Provider failure and timeout forecast |
| Outcome | Action succeeds technically but harms the goal | Expected postconditions, compensation, outcome closure | Probability of verified success, expected loss, time to closure |
| Oversight | Rubber-stamping or delayed review | Dual control, hard timeout behavior | Approval-signal degradation |
| Harness | Bad memory, orchestration, prompt, or integration | Version pinning, replay, conformance tests | Trace anomaly and failure attribution |
| Drift | New users, tools, models, or environments | Version-scoped autonomy reset | Distribution-shift and calibration-drift alarms |

## Assurance and forecasting planes

```text
        probabilistic agent proposes action
                        │
                        ▼
             canonical Action Contract
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
 deterministic assurance       forecasting plane
 · schemas                     · failure probability
 · evidence verification       · unsafe-state reachability
 · invariants                  · OOD / drift score
 · authorization               · expected outcome / loss
 · hard exposure limits        · time-to-closure forecast
 · idempotency                 · calibration certificate
          │                           │
          └─────────────┬─────────────┘
                        ▼
             deterministic mode router
        deny < simulate < approve < canary < execute
                        │
                        ▼
                   execution
                        │
                        ▼
            provider + outcome verification
                        │
                        ▼
          labels, calibration, autonomy update
```

### Formal decision rule

Order execution modes from least to most autonomous:

```text
deny < simulate < approve < canary < execute
```

Let:

- `M_policy(x)` be the maximum mode allowed by deterministic rules, evidence,
  policy, and exposure;
- `M_forecast(x)` be the maximum mode certified by calibrated forecasting;
- `M_requested(x)` be the action mode requested by the agent or workflow.

Then:

```text
M_final(x) = min(M_requested(x), M_policy(x), M_forecast(x))
```

Consequences:

- Forecasting can only lower the final mode.
- Missing or invalid forecasts default to a conservative configured mode.
- A newly trained model cannot silently increase autonomy.
- Forecast outputs become deterministic inputs only after versioning,
  calibration, and snapshotting.

## Forecasts Surety should produce

Do not build one opaque trust score. Build forecasts tied to specific decisions
and observable labels.

### 1. Probability of verified action success

Target:

```text
P(provider-confirmed action and all required postconditions pass | context)
```

Use it to select execute, canary, approval, or simulation. Do not use technical
provider success alone as the positive label.

### 2. Expected loss

Target:

```text
E[loss | action, unresolved exposure, context]
```

Loss can include financial amount, compensation cost, rollback cost, customer
impact, and policy severity. Expected loss is more operationally useful than
failure probability because a 1% risk of a destructive action may matter more
than a 20% risk of a harmless action.

### 3. Unsafe-state reachability

Target:

```text
P(trajectory reaches a declared unsafe symbolic state within horizon H)
```

Research on proactive probabilistic model checking shows that learning a
symbolic state-transition model from traces can identify risk before the final
violating action. Surety can use this to interrupt loops, credential
laundering, escalating privilege, or repeated irreversible actions.

### 4. Time to outcome closure

Target:

```text
P(action remains unresolved after time t | context)
```

Use survival analysis or time-to-event models. Actions likely to remain
unconfirmed should consume exposure longer and may require smaller canaries or
manual review.

### 5. Out-of-distribution and drift risk

Target:

```text
distance from the calibrated deployment population
```

Research on natural prompt shift reports large performance degradation even
under moderate distribution shift. Surety should treat unfamiliar action
contracts, users, tools, model versions, workflow versions, and evidence
patterns as reasons to reduce autonomy until new outcomes recalibrate the
system.

### 6. Clarification value

Target:

```text
expected risk reduction from obtaining one missing fact or user answer
```

Structured-uncertainty research frames clarification through expected value of
perfect information. Surety can request a specific missing field or evidence
attestation instead of routing every uncertain action to broad human approval.

### 7. Evidence and trace anomaly

Target:

```text
probability this evidence or execution path is inconsistent with valid traces
```

Use provenance-aware features and constrained behavioral units. This should
trigger more verification or a lower mode, never directly grant execution.

## Appropriate statistical and ML methods

### Beta-Bernoulli reliability

Use a Beta posterior for binary verified outcomes per scoped action class:

```text
p_success ~ Beta(alpha_success, beta_failure)
```

Advantages:

- works with small samples;
- expresses epistemic uncertainty;
- supports conservative lower credible bounds;
- naturally prevents a few successes from granting broad autonomy.

Autonomy should be based on a lower bound, not the posterior mean:

```text
execute only if lower_bound(p_success, confidence) >= required_reliability
```

Scope by at least:

```text
tenant × action-contract version × capability × provider × environment
× workflow version × model/prompt version × verifier set
```

Use hierarchical Bayesian pooling only where domain evidence justifies sharing.

### Conformal risk control and selective acting

Conformal methods are useful for deciding when the system should abstain,
request help, or restrict execution while targeting a configured risk level.

Important limitations:

- ordinary conformal prediction relies on exchangeability assumptions;
- adaptive online agent streams violate those assumptions;
- coverage can fail under distribution shift;
- guarantees apply only to the defined label and population.

Research on anytime-valid conformal selective acting is promising for
deployment streams. Surety should begin with offline shadow evaluation, then
adopt online methods only after testing their validity under real drift.

### Calibrated supervised forecasting

For richer contexts, begin with interpretable tabular models:

- logistic regression;
- gradient-boosted trees;
- survival models;
- monotonic models where risk direction is known.

Calibrate using:

- isotonic regression;
- Platt or temperature scaling where suitable;
- group-conditional calibration;
- Brier score and expected calibration error;
- reliability diagrams;
- precision and recall at each execution-mode threshold.

Complex models are justified only after simpler models fail on held-out
production data.

### Probabilistic model checking

Abstract traces into deterministic symbolic states and learn transition
probabilities from verified trajectories. Use probabilistic reachability to
forecast unsafe future states.

The symbolic abstraction and unsafe states must be reviewed and versioned.
This makes the forecast explainable:

```text
current state → likely transition → unsafe state within 3 steps
```

### Change-point and drift detection

Use statistical monitoring for:

- feature distribution changes;
- calibration error changes;
- provider failure-rate changes;
- action mix changes;
- new trace motifs;
- reviewer behavior changes;
- outcome closure delays.

Drift should lower autonomy, invalidate stale calibration certificates, or
return the action class to shadow mode.

### Causal outcome estimation

An action can correlate with a good outcome without causing it. Where autonomy
depends on business impact, use:

- randomized or staggered experiments where possible;
- matched controls;
- difference-in-differences;
- doubly robust estimation;
- sensitivity analysis.

Causal estimates should influence expected-value forecasts and product
optimization. They should not replace deterministic safety invariants.

## Methods Surety must treat as advisory

### LLM confidence

Do not trust verbalized confidence or token probabilities as an execution
permission. Research finds that high accuracy does not imply calibrated
uncertainty and that good calibration does not necessarily rank errors well.

### Self-consistency and majority vote

Multiple samples can improve accuracy only when errors are sufficiently
independent. Agents using the same model, context, poisoned evidence, or flawed
harness often make correlated errors. Consensus cannot verify an external fact.

Use ensembles to raise scrutiny or generate alternative hypotheses, not as the
sole evidence for consequential actions.

### LLM-as-a-judge

LLM judges are useful for triage, semantic labels, and offline analysis, but
research shows bias, instability, and even sign reversals under calibration
changes. A judge must never be the only component that permits an action.

### Raw benchmark scores

Benchmarks often omit production distribution shift, tool failures, costs,
human behavior, and outcome closure. Surety must prioritize replayable
deployment traces and verified outcomes over headline benchmark scores.

### Model-reported success

The agent's own claim that it succeeded is not a label. Success comes from an
independent provider receipt and verified postconditions.

## Data foundation

Forecast quality will be limited by the integrity of Surety's labels and
provenance. Before sophisticated ML, build the event model.

### Reliability event

```ts
interface ReliabilityEvent {
  id: string
  tenant_id: string
  action_contract_id: string
  action_contract_version: string
  capability: string
  provider_id: string
  environment: string
  agent_id: string
  model_id?: string
  prompt_hash?: string
  workflow_version?: string
  verifier_set_hash: string
  evidence_snapshot_hash: string
  policy_hash: string
  feature_snapshot_hash: string
  requested_mode: ExecutionMode
  policy_mode: ExecutionMode
  forecast_mode: ExecutionMode
  final_mode: ExecutionMode
  forecast_version?: string
  predicted_success?: number
  predicted_loss_minor?: number
  predicted_unsafe_reachability?: number
  drift_score?: number
  decision_receipt_id: string
  provider_receipt_id?: string
  outcome_status?: 'verified_success' | 'verified_failure' | 'compensated' | 'expired'
  loss_minor?: number
  closed_at?: string
}
```

Never store only derived scores. Retain immutable hashes and versions needed to
recreate the features and decision.

### Label hierarchy

Use explicit labels:

1. `policy_valid`: deterministic admission inputs were valid.
2. `provider_confirmed`: provider confirmed the intended side effect.
3. `postconditions_passed`: required immediate postconditions passed.
4. `business_outcome_positive`: delayed outcome met the defined target.
5. `loss_minor`: realized negative impact.
6. `compensated`: rollback or compensation was required.

These labels answer different questions and must not be collapsed into one
boolean.

### Data quality rules

- Unknown and expired outcomes remain negative evidence for autonomy until
  resolved.
- Human approval is not a positive outcome label.
- Dry runs and simulations are stored separately from real execution.
- Model, prompt, workflow, provider, policy, and verifier version changes are
  explicit.
- Training, calibration, and evaluation windows are time-separated.
- Tenant boundaries and privacy constraints are preserved.

## Forecast certification

A forecast model must not influence execution until it has a signed,
versioned certification artifact:

```ts
interface ForecastCertificate {
  forecast_id: string
  model_hash: string
  feature_schema_version: string
  label_definition_version: string
  training_window: { from: string; to: string }
  calibration_window: { from: string; to: string }
  valid_for_scopes: string[]
  valid_until: string
  thresholds: Record<ExecutionMode, number>
  metrics: {
    brier_score: number
    calibration_error: number
    false_allow_rate: number
    false_block_rate: number
    coverage: number
  }
  fallback_mode: ExecutionMode
}
```

The deterministic router validates the certificate before using the forecast.
Expired, missing, drifted, or scope-mismatched certificates trigger the
configured fallback mode.

## Research program

### Phase R0: Measurement before prediction

Build:

- canonical Action Contract and evidence snapshots;
- provider and outcome closure receipts;
- reliability event schema;
- deterministic replay harness;
- explicit failure and loss labels;
- versioned policy and feature snapshots.

Exit criteria:

- more than 95% of consequential actions close with a known outcome;
- every admission decision is replayable;
- no human approval is counted as successful execution;
- baseline failure rates are measured by action class.

### Phase R1: Conservative reliability bounds

Build:

- Beta-Bernoulli reliability per scoped action class;
- lower-bound-based autonomy thresholds;
- decay and reset after material version changes;
- open-loop exposure budgets;
- time-to-closure monitoring.

Exit criteria:

- lower bounds achieve claimed coverage on held-out time windows;
- no increase in verified incorrect actions versus static HITL;
- measurable reduction in routine approvals;
- autonomy returns to conservative mode under synthetic drift.

### Phase R2: Forecast-assisted mode routing

Build:

- calibrated action-success and expected-loss forecasts;
- explicit mode router using `min(policy, forecast, requested)`;
- forecast certificates;
- shadow and canary deployment;
- group-conditional calibration reports.

Exit criteria:

- lower verified loss at equal or higher action completion;
- false-allow rate remains below the configured threshold;
- forecasts improve over Beta-Bernoulli and deterministic baselines;
- invalid or drifted forecast certificates fail closed.

### Phase R3: Trajectory forecasting

Build:

- symbolic trace abstraction;
- loop, privilege-escalation, and evidence-laundering states;
- unsafe-state reachability forecasting;
- recovery and intervention policies;
- failure attribution to harness layers.

Exit criteria:

- unsafe trajectories are interrupted earlier than action-only rules;
- intervention does not create unacceptable completion loss;
- explanations identify the state and transition driving the intervention;
- trace abstraction remains stable across supported frameworks.

### Phase R4: Outcome and causal optimization

Build:

- delayed business-outcome forecasts;
- causal attribution experiments;
- value-of-information clarification;
- adaptive canary sizing;
- privacy-preserving cross-tenant priors where justified.

Exit criteria:

- measured business outcomes improve, not only technical success;
- causal methods show robustness to confounding assumptions;
- cross-tenant pooling never weakens tenant-specific safety bounds;
- optimization cannot override deterministic invariants.

## Evaluation requirements

Every new reliability feature must be compared against:

- deterministic rules only;
- static human approval;
- current Surety graduated trust;
- simple Beta-Bernoulli lower bounds;
- the proposed ML or forecasting method.

Report:

- false-allow and false-block rates;
- verified loss and expected loss;
- outcome-closure coverage and delay;
- action completion and approval load;
- calibration metrics;
- drift performance;
- intervention lead time;
- compute and latency;
- results by tenant, action class, provider, and environment.

Avoid claiming a reliability improvement from average accuracy alone.

## Implications for Surety

### Product identity

Surety should become:

> **A deterministic execution-assurance layer with calibrated foresight.**

It does not predict because predictions are inherently trustworthy. It predicts
to know when deterministic controls should become stricter.

### Technical moat

The defensible asset is not a generic risk model. It is the closed-loop dataset
and semantics connecting:

```text
evidence → decision → execution → provider confirmation → verified outcome
```

That dataset enables calibrated forecasts, failure attribution, domain
verification packs, and safer autonomy thresholds.

### Near-term implementation priority

Do not begin with a neural risk model. Build, in order:

1. outcome closure and explicit labels;
2. durable open-loop exposure accounting;
3. replayable reliability events;
4. Beta-Bernoulli lower bounds;
5. drift-triggered autonomy reduction;
6. calibrated expected-loss forecasting;
7. trajectory reachability forecasting.

### Recommended first experiment

Use one narrow action class, such as a Stripe refund, and shadow every proposed
action without changing execution behavior.

Collect:

- final canonical payload and verified preconditions;
- policy decision and human decision;
- provider confirmation or failure;
- immediate postconditions;
- realized loss or compensation;
- time to closure;
- all relevant version identifiers.

Compare three routers on a time-separated holdout set:

1. deterministic policy only;
2. deterministic policy plus Beta-Bernoulli lower bound;
3. deterministic policy plus calibrated expected-loss forecast.

The forecast earns a production canary only if it lowers verified loss or
approval load without exceeding the configured false-allow rate. Otherwise,
retain the deterministic baseline and improve labels or features.

## Sources

### Standards and operational guidance

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST AI Agent Standards Initiative](https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative)
- [OWASP Agentic AI Threats and Mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/)
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)

### Agent failure, provenance, and runtime verification

- [MIRAGE-Bench: LLM Agent Hallucinations](https://arxiv.org/abs/2507.21017)
- [Pro2Guard: Probabilistic Runtime Enforcement](https://arxiv.org/abs/2508.00500)
- [RvLLM: Runtime Verification with Domain Knowledge](https://arxiv.org/abs/2505.18585)
- [TraceAegis: Behavioral Anomaly Detection](https://arxiv.org/abs/2510.11203)
- [From Agent Traces to Trust](https://arxiv.org/abs/2606.04990)
- [Failure-Aware Observability for Multi-Agent Systems](https://arxiv.org/abs/2606.01365)
- [HarnessFix: Diagnosing and Repairing Harness Flaws](https://arxiv.org/abs/2606.06324)
- [AgentDrift: Unsafe Drift Under Tool Corruption](https://arxiv.org/abs/2603.12564)

### Calibration, selective acting, and forecasting

- [Revisiting Uncertainty Estimation and Calibration of LLMs](https://arxiv.org/abs/2505.23854)
- [Conformal Selective Acting](https://arxiv.org/abs/2605.20270)
- [CoFineLLM: Conformal Finetuning for Robot Planning](https://arxiv.org/abs/2511.06575)
- [Structured Uncertainty Guided Clarification](https://arxiv.org/abs/2511.08798)
- [Beta-Bernoulli Calibration for LLM Forecasting](https://arxiv.org/abs/2605.27668)
- [WorldReasoner: Evidence-Grounded Forecasting](https://arxiv.org/abs/2606.11816)
- [Measuring Natural Prompt Distribution Shift](https://arxiv.org/abs/2604.17650)

### Warnings about probabilistic judges and consensus

- [Bias and Uncertainty in LLM-as-a-Judge Estimation](https://arxiv.org/abs/2605.06939)
- [Existing LLMs Are Not Self-Consistent For Simple Tasks](https://arxiv.org/abs/2506.18781)
- [Calibrating LLM Judges](https://arxiv.org/abs/2512.22245)
