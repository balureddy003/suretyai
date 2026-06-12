from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal, Optional

ReceiptOutcome = Literal["executed", "policy_blocked", "dry_run", "failed"]


@dataclass
class AgentAction:
    """An action an agent intends to perform, presented to the guard before execution."""

    type: str
    """Namespaced action type, e.g. 'email.send', 'payment.refund', 'crm.note'."""

    payload: dict[str, Any]
    """Structured action arguments. Hashed into the receipt; never stored by Surety."""

    estimated_cost_minor: Optional[int] = None
    """Estimated cost in integer minor units (cents/pence). Used by bond limits."""


@dataclass
class GuardRule:
    """A deterministic predicate over an action. Rules must never call an LLM."""

    id: str
    """Stable identifier recorded in receipts when the rule blocks an action."""

    check: Callable[[AgentAction], bool]
    """Returns True when the action passes this rule. Must be deterministic."""

    reason: str
    """Human-readable explanation used when the rule blocks an action."""


@dataclass
class ActionReceipt:
    """
    Action Receipt v0.1 — the tamper-evident record of a gate decision.

    Field names and semantics are normative; see spec/action-receipt.md.
    """

    id: str
    """UUID v4, unique per decision."""

    spec: str
    """Spec identifier, always 'action-receipt/v0.1' for this version."""

    action_type: str
    """The action's namespaced type."""

    payload_hash: str
    """SHA-256 hex digest of the canonical JSON serialization of the payload."""

    timestamp: str
    """ISO 8601 timestamp of the decision."""

    allowed: bool
    """True = action allowed, False = blocked."""

    failed_rules: list[str] = field(default_factory=list)
    """IDs of the rules that blocked the action. Empty when allowed."""

    agent_id: Optional[str] = None
    """Identifier of the agent whose action was evaluated."""

    tenant_id: Optional[str] = None
    """Tenant scope for multi-tenant deployments."""

    outcome: Optional[ReceiptOutcome] = None
    """What actually happened after the decision, when known."""

    outcome_reason: Optional[str] = None
    """Human-readable reason for a block or failure."""

    dry_run: Optional[bool] = None
    """True when the action was simulated rather than executed."""

    prev_receipt_hash: Optional[str] = None
    """SHA-256 hex digest of the previous receipt, forming a tamper-evident chain."""


@dataclass
class GuardResult:
    """Result of presenting an action to a guard."""

    allowed: bool
    """True when every rule passed."""

    failed_rules: list[str]
    """IDs of the rules that failed."""

    reasons: list[str]
    """Human-readable reasons from the failed rules, in the same order."""

    receipt: ActionReceipt
    """The Action Receipt recording this decision."""
