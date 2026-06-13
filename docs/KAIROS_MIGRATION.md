# Replacing `kairos-guard` with Surety AI

> Status: Surety adapter shipped; Kairos production wiring and old-package
> retirement remain.

## Decision

Surety AI replaces `kairos-guard` as the standalone deterministic execution
boundary. Kairos remains the owner of goals, Outcome Contracts, autonomy
policies, provider execution receipts, and measured business outcomes.

Do not fork or copy Surety into the Kairos monorepo. Publish Surety as an
independent package and consume it from Kairos.

## Responsibility boundary

| Kairos owns | Surety owns |
|---|---|
| Outcome Contract and lifecycle | Deterministic pre-action decision |
| Required capabilities and autonomy policy | Canonical action hashing |
| Approval workflow | Hard exposure and budget rules |
| Capability providers and execution | Pre-action decision receipt |
| Provider confirmation receipt | Receipt chaining and verification |
| KPI evidence and outcome assessment | Portable framework adapters |
| Outcome-based autonomy updates | Approval-signal health |

Kairos has two different receipt moments and should retain both:

1. A **Surety Action Receipt** proves what the execution boundary decided
   before the action.
2. A **Kairos provider Action Receipt** proves whether the external provider
   accepted, confirmed, failed, or could not confirm the action.

Link them by adding the Surety receipt ID to the Kairos execution record. Do not
collapse a pre-action decision and a provider confirmation into one status.

## Shipped adapter

Surety exports `createKairosPolicyProvider`, which is structurally compatible
with `@kairos/runtime`'s `PolicyProvider`:

```ts
import { createKairosPolicyProvider } from 'suretyai'

const policyProvider = createKairosPolicyProvider({
  on_receipt: async (receipt, { action }) => {
    await db.collection('surety_action_receipts').insertOne({
      ...receipt,
      goal_id: action.goal_id,
      cycle_id: action.cycle_id,
      plan_step_id: action.plan_step_id,
      idempotency_key: action.idempotency_key,
    })
  },
  rules: ({ policy }) => [
    {
      id: 'refund-exposure',
      check: action =>
        Number(action.payload.amount_minor ?? 0)
          <= Number(policy.limits.max_refund_minor ?? 0),
      reason: 'Refund exceeds the outcome contract exposure limit',
    },
  ],
})
```

Built-in rules:

- block external execution for `recommend_only` contracts;
- block capabilities not listed in `permitted_capabilities`;
- require approval for `review_required` contracts;
- require approval for capabilities listed in `approval_required_for`.

Numeric policy limits are deliberately not interpreted generically. Kairos must
evaluate them against a durable domain-specific budget or exposure store through
the adapter's `rules` callback.

## Required Kairos execution flow

Every external side effect must use the same boundary:

```ts
const decision = await policyProvider.evaluate(contract.autonomy, action)

if (!decision.allowed) {
  throw new PolicyBlockedError(decision.reasons, decision.receipt.id)
}

if (decision.approval_required) {
  return suspendForApproval(action, decision.receipt.id)
}

const providerReceipt = await provider.execute(action)
await linkReceipts(decision.receipt.id, providerReceipt.id)
```

The boundary must run immediately before provider execution, after templates,
LLM output, and human edits have produced the final action payload.

## Kairos migration sequence

### 1. Publish Surety

Publish a release containing `createKairosPolicyProvider`. Kairos must depend on
a normal versioned package, not `file:../suretyai`, so its builds remain
reproducible outside one developer machine.

### 2. Install in the execution-owning package

Add `suretyai` to the Kairos package that owns the execution boundary. Prefer a
small execution-assurance package or `@kairos/runtime`; avoid adding separate
Surety instances independently to every application.

### 3. Inject the provider

Add the policy provider to workflow and agent execution context, then require it
before:

- `ConnectorActionExecutor.execute`;
- mutating workflow HTTP nodes;
- legacy `ActionExecutor` side effects;
- `OutcomeAgentToolExecutor.execute`;
- any future capability provider.

Read-only capabilities may use a lighter policy, but they should still produce
receipts when they supply evidence used to authorize later writes.

### 4. Make receipts durable

Persist every Surety decision receipt before executing the external side effect.
If required receipt persistence fails, fail closed for consequential writes.

Use the Kairos provider receipt's idempotency key to prevent duplicate
execution. Use Surety's payload hash to prove the executed payload matches the
approved payload.

### 5. Add open-loop exposure rules

Before execution, count Kairos provider receipts in `accepted` or `unknown`
states that have not reached `confirmed`, `failed`, or compensation.

Recommended initial limits:

- maximum unresolved action count per goal;
- maximum unresolved financial exposure per goal and tenant;
- maximum unresolved actions per external subject;
- maximum time an action may remain unconfirmed.

### 6. Retire `kairos-guard`

After every production side-effect path uses Surety:

- remove `packages/kairos-guard`;
- remove its workspace lockfile entry;
- replace documentation and planning references;
- retain compatibility notes for users of the old package;
- publish a final deprecated `kairos-guard` release that points to `suretyai`.

Do not retire it earlier. Today it has no production consumers, so deleting it
before wiring Surety would change branding without improving enforcement.

## Acceptance criteria

The replacement is complete only when:

- no Kairos production path can perform an external write without a Surety
  decision;
- the exact final payload is hashed after all edits and immediately before
  execution;
- a missing policy provider or receipt store fails closed;
- each provider execution receipt links to its Surety decision receipt;
- duplicate idempotency keys cannot execute twice;
- open-loop exposure limits block additional actions;
- policy blocks, approvals, provider confirmations, failures, and unknown
  outcomes have integration tests;
- `rg "kairos-guard"` returns only migration or historical compatibility notes.

## What not to migrate

Do not replace these Kairos concepts with Surety equivalents:

- Outcome Contracts;
- KPI evidence;
- provider Action Receipts;
- goal lifecycle;
- provider registry;
- outcome attribution.

Surety is the execution assurance layer beneath those concepts, not a second
outcome system.
