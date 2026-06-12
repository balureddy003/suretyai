import time
import pytest
from suretyai.health import ApprovalSignalHealth


def test_healthy_with_no_decisions():
    h = ApprovalSignalHealth()
    r = h.assess()
    assert r.healthy is True
    assert r.flags == []


def test_rapid_fire():
    now = [0.0]
    h = ApprovalSignalHealth(now=lambda: now[0])

    for _ in range(4):
        h.record(True)
        now[0] += 0.1

    assert "rapid_fire" in h.assess().flags


def test_batch_approval():
    now = [0.0]
    h = ApprovalSignalHealth(now=lambda: now[0])

    for _ in range(6):
        h.record(True)
        now[0] += 1.0

    assert "batch_approval" in h.assess().flags


def test_no_variance():
    h = ApprovalSignalHealth()
    for _ in range(20):
        h.record(True)
    assert "no_variance" in h.assess().flags


def test_no_variance_not_flagged_under_20():
    h = ApprovalSignalHealth()
    for _ in range(19):
        h.record(True)
    assert "no_variance" not in h.assess().flags


def test_dismiss_spike():
    h = ApprovalSignalHealth()
    for _ in range(7):
        h.record(True)
    for _ in range(4):
        h.record(False)   # 4/11 ≈ 36% in last 10
    assert "dismiss_spike" in h.assess().flags


def test_approval_rate():
    h = ApprovalSignalHealth()
    for _ in range(3):
        h.record(True)
    h.record(False)
    assert abs(h.assess().approval_rate - 0.75) < 0.01


def test_prunes_beyond_max_window():
    h = ApprovalSignalHealth(max_window=5)
    for _ in range(10):
        h.record(True)
    assert len(h.snapshot()) == 5
