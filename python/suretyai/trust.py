from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import IntEnum
from typing import Callable, Optional


class TrustLevel(IntEnum):
    """Graduated trust levels. Higher = more autonomy."""
    SUPERVISED = 0
    PROBATIONARY = 1
    TRUSTED = 2
    BONDED = 3


TRUST_LEVEL_NAMES = {
    TrustLevel.SUPERVISED: "supervised",
    TrustLevel.PROBATIONARY: "probationary",
    TrustLevel.TRUSTED: "trusted",
    TrustLevel.BONDED: "bonded",
}


@dataclass
class TrustEntry:
    agent_id: str
    action_type: str
    level: TrustLevel
    approvals: int
    rejections: int
    consecutive_approvals: int
    updated_at: str


@dataclass
class GraduationThresholds:
    supervised_to_probationary: int = 5
    probationary_to_trusted_approvals: int = 15
    probationary_to_trusted_max_rejection_rate: float = 0.15
    trusted_to_bonded_approvals: int = 30
    trusted_to_bonded_max_rejection_rate: float = 0.05


@dataclass
class RecordResult:
    level: TrustLevel
    graduated: bool
    demoted: bool


class TrustLedger:
    """
    Tracks per-(agent_id, action_type) trust levels.

    Example::

        trust = TrustLedger()
        trust.get_level("agent-1", "email.send")  # TrustLevel.SUPERVISED

        for _ in range(5):
            trust.record("agent-1", "email.send", True)
        trust.get_level("agent-1", "email.send")  # TrustLevel.PROBATIONARY

        trust.record("agent-1", "email.send", False)
        trust.get_level("agent-1", "email.send")  # TrustLevel.SUPERVISED (demoted)
    """

    def __init__(
        self,
        thresholds: Optional[GraduationThresholds] = None,
        now: Optional[Callable[[], datetime]] = None,
    ) -> None:
        self._entries: dict[str, TrustEntry] = {}
        self._thresholds = thresholds or GraduationThresholds()
        self._now = now or (lambda: datetime.now(tz=timezone.utc))

    def get_level(self, agent_id: str, action_type: str) -> TrustLevel:
        return self._get_or_create(agent_id, action_type).level

    def get_entry(self, agent_id: str, action_type: str) -> TrustEntry:
        e = self._get_or_create(agent_id, action_type)
        return TrustEntry(**e.__dict__)

    def record(self, agent_id: str, action_type: str, approved: bool) -> RecordResult:
        entry = self._get_or_create(agent_id, action_type)
        prev_level = entry.level

        if approved:
            entry.approvals += 1
            entry.consecutive_approvals += 1
            entry.level = self._graduate(entry)
        else:
            entry.rejections += 1
            entry.consecutive_approvals = 0
            if entry.level > TrustLevel.SUPERVISED:
                entry.level = TrustLevel(entry.level - 1)

        entry.updated_at = self._now().isoformat()

        return RecordResult(
            level=entry.level,
            graduated=entry.level > prev_level,
            demoted=entry.level < prev_level,
        )

    def export(self) -> dict[str, dict]:  # type: ignore[type-arg]
        return {k: v.__dict__.copy() for k, v in self._entries.items()}

    @classmethod
    def from_state(
        cls,
        state: dict[str, dict],  # type: ignore[type-arg]
        thresholds: Optional[GraduationThresholds] = None,
        now: Optional[Callable[[], datetime]] = None,
    ) -> "TrustLedger":
        ledger = cls(thresholds=thresholds, now=now)
        for key, data in state.items():
            d = dict(data)
            d["level"] = TrustLevel(d["level"])
            ledger._entries[key] = TrustEntry(**d)
        return ledger

    def _get_or_create(self, agent_id: str, action_type: str) -> TrustEntry:
        key = f"{agent_id}::{action_type}"
        if key not in self._entries:
            self._entries[key] = TrustEntry(
                agent_id=agent_id,
                action_type=action_type,
                level=TrustLevel.SUPERVISED,
                approvals=0,
                rejections=0,
                consecutive_approvals=0,
                updated_at=self._now().isoformat(),
            )
        return self._entries[key]

    def _graduate(self, entry: TrustEntry) -> TrustLevel:
        t = self._thresholds
        total = entry.approvals + entry.rejections
        rejection_rate = entry.rejections / total if total > 0 else 0.0

        if (
            entry.level == TrustLevel.SUPERVISED
            and entry.consecutive_approvals >= t.supervised_to_probationary
        ):
            return TrustLevel.PROBATIONARY
        if (
            entry.level == TrustLevel.PROBATIONARY
            and entry.approvals >= t.probationary_to_trusted_approvals
            and rejection_rate <= t.probationary_to_trusted_max_rejection_rate
        ):
            return TrustLevel.TRUSTED
        if (
            entry.level == TrustLevel.TRUSTED
            and entry.approvals >= t.trusted_to_bonded_approvals
            and rejection_rate <= t.trusted_to_bonded_max_rejection_rate
        ):
            return TrustLevel.BONDED
        return entry.level
