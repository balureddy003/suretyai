## Summary

<!-- Describe the change in 1-2 sentences. What problem does it solve? -->

## What changed

<!-- Bullet points of what was added, removed, or fixed -->

## Invariants checklist

Before submitting, confirm this PR respects the project's core invariants:

- [ ] **Zero runtime dependencies** — no new runtime deps in TS or Python core
- [ ] **Rules stay deterministic** — no LLM call decides `allowed: true`
- [ ] **Fail closed** — ambiguous or misconfigured paths block, never silently allow
- [ ] **Money is integer minor units** — no floating-point for financial values
- [ ] **TS/Python parity** — feature lands in both, or PR states the parity plan

## Test plan

- [ ] `npm run typecheck && npm test` passes (55 TS tests)
- [ ] `cd python && pytest` passes (38 Python tests)
- [ ] `npm run eval` stays green (reproducible claims)
- [ ] `npm run examples` runs clean (all 5 demos)

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation improvement
- [ ] Refactor

## Related issues

<!-- Link any related issues: Fixes #123, Closes #456 -->

## Additional notes

<!-- Anything else reviewers should know -->
