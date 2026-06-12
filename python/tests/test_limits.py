from datetime import datetime, timezone
from suretyai import create_guard, BondLimits, BondLimitsConfig
from suretyai.types import AgentAction

send = AgentAction(type="email.send", payload={}, estimated_cost_minor=100)


def test_blocks_beyond_daily_action_ceiling():
    limits = BondLimits(BondLimitsConfig(max_actions_per_day=2))
    guard = create_guard([limits.rule()])

    for _ in range(2):
        assert guard(send).allowed is True
        limits.record(send)

    third = guard(send)
    assert third.allowed is False
    assert third.failed_rules == ["bond-limits"]


def test_blocks_when_spend_would_exceed_ceiling():
    limits = BondLimits(BondLimitsConfig(max_spend_per_day_minor=250))
    guard = create_guard([limits.rule()])

    assert guard(send).allowed is True
    limits.record(send)   # 100 spent
    assert guard(send).allowed is True
    limits.record(send)   # 200 spent
    assert guard(send).allowed is False   # 300 > 250
    assert limits.remaining()["spend_minor"] == 50


def test_budget_not_consumed_at_gate_time():
    limits = BondLimits(BondLimitsConfig(max_actions_per_day=1))
    guard = create_guard([limits.rule()])

    for _ in range(5):
        assert guard(send).allowed is True

    limits.record(send)
    assert guard(send).allowed is False


def test_resets_at_utc_midnight():
    now = datetime(2026, 6, 10, 23, 50, tzinfo=timezone.utc)
    limits = BondLimits(BondLimitsConfig(max_actions_per_day=1, now=lambda: now))
    guard = create_guard([limits.rule()])

    assert guard(send).allowed is True
    limits.record(send)
    assert guard(send).allowed is False

    now = datetime(2026, 6, 11, 0, 1, tzinfo=timezone.utc)
    assert guard(send).allowed is True
