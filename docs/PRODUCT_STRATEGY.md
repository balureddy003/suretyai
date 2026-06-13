# Surety AI Product Strategy

> Research date: 2026-06-12
>
> Decision: build Surety around **outcome-bonded autonomy**, not generic agent
> governance.

## Executive conclusion

The market need is real: enterprises need agents to take more actions without
turning every action into a human approval or accepting uncontrolled risk.
However, the broad agent-governance market is already crowded.

The following capabilities are becoming platform features:

- deterministic tool policies and audit logs;
- human approval and resumable workflows;
- agent identity, inventory, permissions, and kill switches;
- runtime threat detection and intent analysis;
- agent traces, observability, and offline evaluation.

Surety should not try to win by combining those features in another broad
control plane. Its differentiated question should be:

> **What evidence makes this action justified now, did the action produce the
> promised outcome, and has this agent earned the right to do more?**

The proposed category is **outcome-bonded autonomy**:

1. An agent proposes an action.
2. Authoritative evidence verifies the action's factual assumptions.
3. Policy and exposure budgets select the permitted execution mode.
4. The action remains an open liability until its outcome is verified.
5. Only verified outcomes increase future autonomy.

This does not solve hallucination inside an LLM. It makes unsupported
hallucinated actions non-executable and false success claims unable to earn
trust.

The research path adds **calibrated foresight**: forecast failure, loss, drift,
and unsafe trajectories so the deterministic boundary can intervene earlier.
Forecasts have one-way authority and may only reduce autonomy. See
[RELIABILITY_RESEARCH.md](RELIABILITY_RESEARCH.md).

## Market map

### Capabilities that are commoditizing

| Layer | Current evidence | Implication for Surety |
|---|---|---|
| Framework-native HITL | OpenAI Agents SDK supports conditional tool approvals, durable pause/resume, and programmatic approval. LangGraph supports persistent interrupts and resumable state. | Approval gates alone are not a product. |
| Deterministic authorization | AWS AgentCore Policy intercepts agent-to-tool traffic and enforces Cedar policies outside agent code. Permit.io offers fine-grained agent authorization and audit logs. | "Rules decide, LLMs propose" is necessary but not unique. |
| Enterprise agent control plane | Microsoft Agent 365 provides registry, lifecycle governance, risk-based access, compliance, and runtime protection. | Do not compete on fleet inventory, IAM, or a generic dashboard. |
| Agent security platforms | Zenity and Lasso offer discovery, posture management, runtime enforcement, threat detection, and response. | Do not position as broad agent security. |
| Observability and evaluation | OpenTelemetry defines GenAI and agent spans. LangSmith and Arize provide tracing and agent evaluation. | Receipts must be decision evidence, not another trace format. |
| Identity standards | NIST is actively developing agent identity, authorization, interoperability, and security guidance. | Integrate with identity standards; do not invent a parallel identity system. |

### Signals that the need is durable

- NIST's AI Agent Standards Initiative explicitly focuses on trusted,
  interoperable, secure autonomous actions and agent identity infrastructure.
- NIST NCCoE states that the scale and range of agent actions can increase
  exponentially and is exploring standards-based identity and authorization.
- The EU AI Act requires automatic event recording for high-risk systems and
  human oversight proportionate to risk, autonomy, and context. It also calls
  out automation bias, override, and interruption.
- OWASP maintains an Agentic Security Initiative focused on threats created by
  autonomous action.
- Cloud and security vendors are shipping agent-specific enforcement, which
  validates the budget while making generic governance a poor entry point.

### The emerging research boundary

The whitespace is not academically empty. Recent work is converging on:

- proof-carrying agent actions with assumption capture and outcome closure;
- runtime governance over an agent's execution path, not only isolated calls;
- pre-action gates, action-time monitors, and post-action auditors;
- outcome-oriented agent evaluation;
- verification-native clearing for agentic commerce.

This creates a time-limited opportunity. Surety must ship a simple,
production-usable implementation rather than lead with a new abstract standard.

## The unique product thesis

### Category

**Closed-loop runtime assurance for AI agents**

### Differentiator

**Outcome-bonded autonomy**

### Core promise

> Surety lets probabilistic agents earn a bounded, revocable autonomy limit
> from verified real-world outcomes.

### Positioning

For teams operating agents that change customer, financial, or production
state, Surety is the runtime assurance layer that verifies the facts behind an
action, limits unresolved exposure, and grants more autonomy only after
successful outcomes are independently confirmed.

Unlike IAM and policy engines, Surety does not stop at whether an agent is
permitted to call a tool. Unlike HITL, it does not treat a click as proof of
correctness. Unlike observability, it changes what the agent may do next.

### Memorable language

- **Probabilistic agents. Verified actions.**
- **Trust outcomes, not model confidence.**
- **Every action begins with evidence and ends with proof.**
- **Autonomy is a revocable credit line backed by verified outcomes.**
- **Make unsupported actions non-executable.**

Avoid claiming:

- that Surety prevents or detects all hallucinations;
- that a receipt proves an action was correct;
- that hash chains are tamper-proof;
- that human approval proves correctness;
- that a fixed approval count proves reliability;
- that Surety makes a system compliant by itself.

## Product model

### 1. Action Contract

Replace an unstructured tool call as the primary governed object with a typed
Action Contract:

```ts
interface ActionContract {
  id: string
  action: AgentAction
  subject: { type: string; id: string }
  contract_type: string
  contract_version: string
  claims: RequiredClaim[]
  invariants: RequiredInvariant[]
  expected_outcomes: ExpectedOutcome[]
  exposure_minor?: number
  compensation?: CompensationPlan
  expires_at: string
}
```

The contract states what the agent wants to do, which facts must be true, what
must remain true, what success looks like, and how much exposure the action
creates.

### 2. Evidence Attestations

Claims must be checked by independent verifiers. The LLM may identify a claim,
but it cannot attest that the claim is true.

```ts
interface EvidenceAttestation {
  claim_id: string
  verifier_id: string
  verifier_version: string
  assurance: 'authoritative' | 'deterministic' | 'human' | 'probabilistic'
  observed_at: string
  expires_at?: string
  passed: boolean
  value_hash?: string
  signature?: string
}
```

Examples for a refund:

- the invoice exists in the billing system;
- the requesting customer owns the invoice;
- payment was captured;
- refundable balance is sufficient;
- no prior refund is in flight;
- the request is inside policy and daily exposure limits.

Probabilistic checks can increase scrutiny, but must never be the sole evidence
that grants a consequential action.

### 3. Execution modes

Admission selects a mode rather than only returning allow or deny:

| Mode | Meaning |
|---|---|
| `deny` | Missing evidence, failed invariant, or hard policy violation. |
| `simulate` | Run without external effect and verify predicted postconditions. |
| `approve` | Require a qualified human or dual-control approval. |
| `canary` | Permit a smaller or reversible action first. |
| `execute` | Permit within the agent's current autonomy and exposure limits. |

No amount of historical success overrides missing evidence or a hard rule.

### 4. Outcome closure

An allowed action is not a success. It remains open until an independent
verifier confirms its postconditions.

```ts
interface OutcomeAttestation {
  action_contract_id: string
  verifier_id: string
  status: 'verified_success' | 'verified_failure' | 'compensated' | 'expired'
  observed_at: string
  observed_hash?: string
  reason?: string
}
```

Examples:

- refund provider confirms the exact refund completed once;
- customer account balance changed by the expected amount;
- infrastructure health remained inside defined bounds after deployment;
- generated code passed required tests and did not change protected files.

### 5. Open-loop exposure

Actions awaiting outcome closure consume an **open-loop exposure budget**.
This prevents an agent from issuing hundreds of actions before the first bad
outcome becomes visible.

Useful limits include:

- maximum unresolved action count;
- maximum unresolved financial exposure;
- maximum time without outcome closure;
- maximum correlated exposure to one customer, system, or action class.

This is more meaningful than a daily action counter because it measures current
unverified liability.

### 6. Outcome-based autonomy

Replace approval-count graduation with reliability inferred from verified
outcomes.

Trust should be scoped to:

```text
agent identity
× action contract type and version
× environment
× tool/provider version
× verifier set
```

Use a conservative statistical lower bound rather than a raw success rate.
Autonomy increases only when the lower bound exceeds a configured reliability
target after a minimum sample size. It decays or resets after material changes
to the model, prompt, tools, contract, or verifiers.

Failures, expired outcomes, compensation events, and evidence contradictions
reduce autonomy. Human approval is an authorization signal, not a successful
outcome.

## Why this is defensible

Hash chains, static rules, and approval thresholds are easy to copy. The
defensible assets are:

1. **Domain verification packs.** Production-ready contracts, verifiers,
   postconditions, and compensation patterns for specific consequential
   workflows.
2. **Outcome reliability data.** A privacy-preserving history of which contract,
   verifier, tool, and environment combinations produce reliable outcomes.
3. **Integration coverage.** A neutral layer connecting frameworks, policy
   engines, systems of record, and outcome sources.
4. **Assurance semantics.** A clear distinction between authoritative,
   deterministic, human-attested, and probabilistic evidence.
5. **Operational economics.** Measured reduction in reviewer work and incidents,
   tied directly to autonomy decisions.

The long-term standard should emerge from production usage. Do not make
standardization the initial product.

## Initial market wedge

### Ideal workflow characteristics

Choose a workflow where:

- actions repeat hundreds or thousands of times;
- a human currently approves many routine actions;
- preconditions are available from authoritative systems;
- outcomes are observable within minutes or hours;
- damage is financially measurable and bounded;
- actions are reversible or compensatable;
- the team has a clear owner and operating metric.

### Recommended first wedge

**Customer-support refunds and account credits**

Why:

- hallucinated entities and incorrect state assumptions are common failure
  modes;
- billing and CRM systems provide authoritative facts;
- the action has clear financial exposure;
- outcomes are observable;
- teams already use thresholds and approvals;
- reviewer time and loss rates are easy to measure.

Start with Stripe plus one support platform. The product should sit between an
agent's refund proposal and the payment API.

### Second wedge

**Production infrastructure changes**

Use evidence from CI, policy engines, deployment systems, and health metrics.
Require canaries and close outcomes from post-deployment health. This is a
strong developer-led distribution path, but the production integration burden
is higher.

### Avoid initially

- hiring, lending, medical, or other decisions about people;
- open-ended browser agents;
- consumer shopping and payment mandates;
- broad enterprise agent discovery;
- generic hallucination detection;
- a compliance dashboard without an enforced workflow.

## Buyer and business model

### Initial buyer

Sell to the operational owner of the automated workflow:

- Head of Support Operations;
- VP of Customer Experience;
- FinOps or payments operations lead;
- platform engineering or SRE lead.

Security and compliance are required stakeholders, but a pure CISO sale puts
Surety into direct competition with larger agent-security platforms.

### Economic value

The product must demonstrate:

- reviewer minutes eliminated;
- percentage of actions safely automated;
- unsupported actions blocked;
- false-block rate;
- verified success and compensation rates;
- unresolved exposure over time;
- time to outcome closure;
- losses or incidents avoided.

### Commercial shape

- Open-source SDK: contracts, local verifiers, execution modes, receipts.
- Paid control plane: durable state, distributed exposure budgets, approval
  routing, outcome closure, dashboards, alerts, and audit exports.
- Paid domain packs: maintained integrations and verification contracts for
  billing, support, and infrastructure systems.

Pricing should align with verified consequential actions or managed exposure,
not seats.

## Validation plan

Do not build the full control plane before proving the workflow.

### Design-partner test

1. Interview 15 teams already running or piloting action-taking support agents.
2. Require evidence of at least 500 proposed consequential actions per week.
3. Shadow-run Surety against historical or live proposals without execution.
4. Compare policy-only, static HITL, and outcome-bonded modes.
5. Convert at least three teams into design partners.

### Go/no-go metrics

Continue investing when a design partner demonstrates:

- at least 50% fewer routine human approvals;
- no increase in verified incorrect actions;
- less than 2% false blocks on eligible routine actions;
- outcome closure for more than 95% of executed actions;
- a buyer willing to pay for the measured reduction in operational work or
  exposure.

If buyers only want logs, identity, or generic policy, integrate with the
incumbents rather than expanding into their categories.

## Sources

### Standards and regulation

- [NIST AI Agent Standards Initiative](https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative)
- [NIST NCCoE: Software and AI Agent Identity and Authorization](https://www.nccoe.nist.gov/projects/software-and-ai-agent-identity-and-authorization)
- [EU AI Act, Articles 12 and 14](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [OWASP Agentic AI Threats and Mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/)
- [OpenTelemetry semantic conventions for GenAI systems](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)

### Products and platforms

- [AWS AgentCore Policy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html)
- [Microsoft Agent 365](https://learn.microsoft.com/en-us/microsoft-agent-365/overview)
- [OpenAI Agents SDK human-in-the-loop](https://openai.github.io/openai-agents-python/human_in_the_loop/)
- [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [Permit.io AI access control](https://www.permit.io/ai-access-control)
- [Zenity agent security and governance](https://zenity.io/platform)
- [Lasso AI security platform](https://www.lasso.security/)
- [LangSmith observability](https://www.langchain.com/langsmith/observability)
- [Arize AI Agents handbook](https://arize.com/ai-agents/)

### Recent research signals

- [Proof-Carrying Agent Actions](https://arxiv.org/abs/2606.04104)
- [Runtime Governance for AI Agents: Policies on Paths](https://arxiv.org/abs/2603.16586)
- [SARC: Governance-by-Architecture for Agentic AI](https://arxiv.org/abs/2605.07728)
- [MIRAGE-Bench: Agent Hallucinations](https://arxiv.org/abs/2507.21017)
- [Levels of Autonomy for AI Agents](https://arxiv.org/abs/2506.12469)
- [Towards Outcome-Oriented Evaluation of AI Agents](https://arxiv.org/abs/2511.08242)
- [RAILS: Verification-Native Clearing for Agentic Commerce](https://arxiv.org/abs/2606.08790)
