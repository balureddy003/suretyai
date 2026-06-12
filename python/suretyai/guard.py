from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Optional

from suretyai.canonical import canonicalize
from suretyai.types import ActionReceipt, AgentAction, GuardResult, GuardRule

SPEC_VERSION = "action-receipt/v0.1"

Guard = Callable[[AgentAction], GuardResult]


@dataclass
class GuardOptions:
    agent_id: Optional[str] = None
    """Recorded as agent_id on every receipt."""

    tenant_id: Optional[str] = None
    """Recorded as tenant_id on every receipt."""

    chain: bool = False
    """When True, each receipt carries the SHA-256 hash of the previous one."""

    now: Optional[Callable[[], datetime]] = None
    """Injectable clock, for deterministic tests."""


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def hash_payload(payload: dict) -> str:  # type: ignore[type-arg]
    """SHA-256 hex digest of the canonical JSON serialization of a payload."""
    return _sha256(canonicalize(payload))


def hash_receipt(receipt: ActionReceipt) -> str:
    """SHA-256 hex digest of the canonical JSON serialization of a receipt."""
    d = {k: v for k, v in receipt.__dict__.items() if v is not None}
    return _sha256(canonicalize(d))


def create_guard(rules: list[GuardRule], options: Optional[GuardOptions] = None) -> Guard:
    """Create a deterministic guard that evaluates agent actions against a set of rules.

    Rules are pure predicates — no LLM is consulted, so the same action
    always produces the same decision.

    Example::

        guard = create_guard([
            GuardRule(
                id="refund-ceiling",
                check=lambda a: a.type != "payment.refund" or a.payload["amount_minor"] <= 5000,
                reason="Refunds above £50.00 require human approval",
            )
        ])

        result = guard(AgentAction(type="payment.refund", payload={"amount_minor": 9900}))
        assert not result.allowed
    """
    opts = options or GuardOptions()
    prev_receipt_hash: Optional[str] = None

    def guard(action: AgentAction) -> GuardResult:
        nonlocal prev_receipt_hash

        failed = [rule for rule in rules if not rule.check(action)]
        allowed = len(failed) == 0

        now_dt = opts.now() if opts.now else datetime.now(tz=timezone.utc)

        receipt = ActionReceipt(
            id=str(uuid.uuid4()),
            spec=SPEC_VERSION,
            agent_id=opts.agent_id,
            tenant_id=opts.tenant_id,
            action_type=action.type,
            payload_hash=hash_payload(action.payload),
            timestamp=now_dt.isoformat(),
            allowed=allowed,
            failed_rules=[r.id for r in failed],
            outcome=None if allowed else "policy_blocked",
            prev_receipt_hash=prev_receipt_hash if opts.chain else None,
        )

        if opts.chain:
            prev_receipt_hash = hash_receipt(receipt)

        return GuardResult(
            allowed=allowed,
            failed_rules=[r.id for r in failed],
            reasons=[r.reason for r in failed],
            receipt=receipt,
        )

    return guard


def verify_chain(receipts: list[ActionReceipt]) -> int:
    """Verify a chained sequence of receipts.

    Returns the index of the first broken link, or -1 if the chain is intact.
    """
    for i in range(1, len(receipts)):
        expected = hash_receipt(receipts[i - 1])
        if receipts[i].prev_receipt_hash != expected:
            return i
    return -1
