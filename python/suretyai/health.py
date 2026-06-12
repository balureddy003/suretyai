from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Literal, Optional

HealthFlag = Literal["rapid_fire", "batch_approval", "no_variance", "dismiss_spike"]


@dataclass
class HealthReport:
    healthy: bool
    flags: list[HealthFlag]
    window_size: int
    approval_rate: float
    assessed_at: str


@dataclass
class _Decision:
    timestamp: float
    approved: bool


class ApprovalSignalHealth:
    """
    Monitors the stream of human approval decisions and surfaces patterns
    that indicate oversight has degraded into rubber-stamping.

    Example::

        health = ApprovalSignalHealth()

        health.record(True)
        health.record(False)

        report = health.assess()
        if not report.healthy:
            print("Oversight degraded:", report.flags)
    """

    def __init__(
        self,
        max_window: int = 200,
        now: Optional[Callable[[], float]] = None,
    ) -> None:
        self._window: list[_Decision] = []
        self._max_window = max_window
        self._now = now or time.time

    def record(self, approved: bool) -> None:
        self._window.append(_Decision(timestamp=self._now(), approved=approved))
        if len(self._window) > self._max_window:
            self._window.pop(0)

    def assess(self) -> HealthReport:
        now = self._now()
        flags: list[HealthFlag] = []

        recent_30s = [d for d in self._window if now - d.timestamp < 30]
        recent_60s = [d for d in self._window if now - d.timestamp < 60]
        last20 = self._window[-20:]
        last10 = self._window[-10:]

        if len(recent_30s) > 3:
            flags.append("rapid_fire")

        approvals_60s = sum(1 for d in recent_60s if d.approved)
        if approvals_60s > 5:
            flags.append("batch_approval")

        if len(last20) >= 20 and all(d.approved for d in last20):
            flags.append("no_variance")

        rejections_10 = sum(1 for d in last10 if not d.approved)
        if len(last10) >= 10 and rejections_10 / len(last10) > 0.3:
            flags.append("dismiss_spike")

        approvals = sum(1 for d in self._window if d.approved)
        approval_rate = approvals / len(self._window) if self._window else 1.0

        return HealthReport(
            healthy=len(flags) == 0,
            flags=flags,
            window_size=len(self._window),
            approval_rate=approval_rate,
            assessed_at=datetime.fromtimestamp(now, tz=timezone.utc).isoformat(),
        )

    def snapshot(self) -> list[_Decision]:
        return list(self._window)
