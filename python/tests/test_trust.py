import pytest
from suretyai.trust import TrustLedger, TrustLevel


def test_starts_supervised():
    t = TrustLedger()
    assert t.get_level("a", "email.send") == TrustLevel.SUPERVISED


def test_graduates_to_probationary_after_5_consecutive():
    t = TrustLedger()
    for _ in range(4):
        t.record("a", "x", True)
    assert t.get_level("a", "x") == TrustLevel.SUPERVISED

    result = t.record("a", "x", True)
    assert result.level == TrustLevel.PROBATIONARY
    assert result.graduated is True


def test_graduation_is_per_action_type():
    t = TrustLedger()
    for _ in range(5):
        t.record("a", "email.send", True)
    assert t.get_level("a", "payment.refund") == TrustLevel.SUPERVISED


def test_graduates_to_trusted():
    t = TrustLedger()
    for _ in range(5):
        t.record("a", "x", True)   # → PROBATIONARY
    for _ in range(10):
        t.record("a", "x", True)   # 15 total
    assert t.get_level("a", "x") == TrustLevel.TRUSTED


def test_graduates_all_the_way_to_bonded():
    t = TrustLedger()
    for _ in range(30):
        t.record("a", "x", True)
    assert t.get_level("a", "x") == TrustLevel.BONDED


def test_demotes_on_rejection_and_resets_streak():
    t = TrustLedger()
    for _ in range(5):
        t.record("a", "x", True)   # → PROBATIONARY
    result = t.record("a", "x", False)

    assert result.level == TrustLevel.SUPERVISED
    assert result.demoted is True
    assert t.get_entry("a", "x").consecutive_approvals == 0


def test_does_not_demote_below_supervised():
    t = TrustLedger()
    t.record("a", "x", False)
    assert t.get_level("a", "x") == TrustLevel.SUPERVISED


def test_export_and_restore():
    t1 = TrustLedger()
    for _ in range(5):
        t1.record("a", "x", True)

    t2 = TrustLedger.from_state(t1.export())
    assert t2.get_level("a", "x") == TrustLevel.PROBATIONARY
    assert t2.get_entry("a", "x").approvals == 5


# ── Regression: outcome-linked trust and graduation suppression ─────────────

def test_suppress_graduation_records_but_does_not_promote():
    t = TrustLedger()
    for _ in range(5):
        r = t.record("a", "x", True, suppress_graduation=True)
        assert r.graduated is False
    # 5 approvals would normally graduate to PROBATIONARY — suppressed.
    assert t.get_level("a", "x") == TrustLevel.SUPERVISED
    assert t.get_entry("a", "x").approvals == 5


def test_record_outcome_failure_demotes():
    t = TrustLedger()
    for _ in range(5):
        t.record("a", "x", True)
    assert t.get_level("a", "x") == TrustLevel.PROBATIONARY

    r = t.record_outcome("a", "x", False)
    assert r.demoted is True
    assert r.level == TrustLevel.SUPERVISED
    assert t.get_entry("a", "x").outcomes_failed == 1


def test_record_outcome_success_adds_no_approval_credit():
    t = TrustLedger()
    for _ in range(10):
        t.record_outcome("a", "x", True)
    # Successful outcomes are tracked but grant no autonomy on their own.
    assert t.get_level("a", "x") == TrustLevel.SUPERVISED
    assert t.get_entry("a", "x").outcomes_succeeded == 10
