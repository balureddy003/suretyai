from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Optional

from suretyai.types import AgentAction, GuardRule


@dataclass
class BondLimitsConfig:
    max_actions_per_day: Optional[int] = None
    """Hard ceiling on executed actions per UTC day."""

    max_spend_per_day_minor: Optional[int] = None
    """Hard ceiling on spend per UTC day, in integer minor units (cents/pence)."""

    now: Optional[Callable[[], datetime]] = None
    """Injectable clock, for deterministic tests."""


class BondLimits:
    """Hard daily circuit breakers on agent activity.

    Limits are checked at gate time via rule() and committed after
    execution via record(), so blocked or abandoned actions never
    consume budget::

        limits = BondLimits(BondLimitsConfig(max_actions_per_day=50, max_spend_per_day_minor=10_000))
        guard = create_guard([limits.rule(), ...other_rules])

        result = guard(action)
        if result.allowed:
            execute(action)
            limits.record(action)

    Counters reset at UTC midnight. State is in-memory and per-instance.
    """

    def __init__(self, config: BondLimitsConfig) -> None:
        self._config = config
        self._day = ""
        self._actions = 0
        self._spend_minor = 0

    def rule(self) -> GuardRule:
        """A guard rule that blocks actions which would exceed today's limits."""
        return GuardRule(
            id="bond-limits",
            check=lambda action: self._would_allow(action),
            reason="Daily bond limit reached (actions or spend ceiling)",
        )

    def record(self, action: AgentAction) -> None:
        """Commit an executed action against today's budget. Call only after execution."""
        self._roll()
        self._actions += 1
        self._spend_minor += action.estimated_cost_minor or 0

    def remaining(self) -> dict[str, Optional[int]]:
        """Remaining budget for today."""
        self._roll()
        return {
            "actions": (
                max(0, self._config.max_actions_per_day - self._actions)
                if self._config.max_actions_per_day is not None
                else None
            ),
            "spend_minor": (
                max(0, self._config.max_spend_per_day_minor - self._spend_minor)
                if self._config.max_spend_per_day_minor is not None
                else None
            ),
        }

    def _would_allow(self, action: AgentAction) -> bool:
        self._roll()
        if (
            self._config.max_actions_per_day is not None
            and self._actions + 1 > self._config.max_actions_per_day
        ):
            return False
        if (
            self._config.max_spend_per_day_minor is not None
            and self._spend_minor + (action.estimated_cost_minor or 0) > self._config.max_spend_per_day_minor
        ):
            return False
        return True

    def _roll(self) -> None:
        now = self._config.now() if self._config.now else datetime.now(tz=timezone.utc)
        today = now.date().isoformat()
        if today != self._day:
            self._day = today
            self._actions = 0
            self._spend_minor = 0
