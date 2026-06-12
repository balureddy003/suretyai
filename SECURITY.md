# Security Policy

Surety AI is a safety layer — vulnerabilities in it are vulnerabilities in everything it guards. We take reports seriously and respond fast.

## Reporting

**Do not open a public issue for security problems.** Use [GitHub private vulnerability reporting](https://github.com/balureddy003/suretyai/security/advisories/new) instead. Expect an acknowledgment within 72 hours.

In scope, especially:

- Guard bypasses: any action that should be blocked but is allowed (rule-evaluation bugs, payload tricks, adapter gaps)
- Receipt integrity: hash collisions, canonicalization divergence between the TS and Python implementations, chain-verification bypasses
- Trust-ledger manipulation: graduating without genuine approvals, dodging demotion, state-restore tampering
- Bond-limit evasion: spending or acting past a configured ceiling
- Health-monitor blinding: approval patterns that should flag but don't

## Supported versions

Pre-1.0: only the latest minor release receives fixes.

## Disclosure

Coordinated: we'll work with you on a timeline (default 90 days), credit you in the advisory unless you prefer otherwise, and backport fixes before publication.
