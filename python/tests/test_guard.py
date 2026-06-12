import pytest
from suretyai import create_guard, hash_payload, hash_receipt, verify_chain, SPEC_VERSION
from suretyai.types import AgentAction, GuardRule


no_delete = GuardRule(
    id="no-delete",
    check=lambda a: a.type != "record.delete",
    reason="Delete actions are not allowed",
)

refund_ceiling = GuardRule(
    id="refund-ceiling",
    check=lambda a: a.type != "payment.refund" or a.payload["amount_minor"] <= 5000,
    reason="Refunds above £50.00 require human approval",
)


def test_allows_actions_passing_all_rules():
    guard = create_guard([no_delete, refund_ceiling])
    result = guard(AgentAction(type="payment.refund", payload={"amount_minor": 1200}))

    assert result.allowed is True
    assert result.failed_rules == []
    assert result.reasons == []
    assert result.receipt.allowed is True
    assert result.receipt.outcome is None


def test_blocks_and_records_every_failed_rule():
    guard = create_guard([no_delete, refund_ceiling])
    result = guard(AgentAction(type="record.delete", payload={"id": "x"}))

    assert result.allowed is False
    assert result.failed_rules == ["no-delete"]
    assert result.reasons == ["Delete actions are not allowed"]
    assert result.receipt.outcome == "policy_blocked"


def test_stamps_receipts_with_spec_and_identity():
    from suretyai.guard import GuardOptions
    guard = create_guard([no_delete], GuardOptions(agent_id="agent-7", tenant_id="t-1"))
    receipt = guard(AgentAction(type="email.send", payload={})).receipt

    assert receipt.spec == SPEC_VERSION
    assert receipt.agent_id == "agent-7"
    assert receipt.tenant_id == "t-1"
    assert receipt.action_type == "email.send"
    assert len(receipt.id) == 36  # UUID


def test_hash_payload_key_order_invariant():
    assert hash_payload({"to": "a@b.c", "meta": {"y": 2, "x": 1}}) == \
           hash_payload({"meta": {"x": 1, "y": 2}, "to": "a@b.c"})


def test_hash_payload_nested_differs():
    assert hash_payload({"a": 1, "b": {"c": 1}}) != hash_payload({"a": 1, "b": {"c": 2}})


def test_chain_links_receipts_and_verifies_intact():
    from suretyai.guard import GuardOptions
    guard = create_guard([no_delete], GuardOptions(chain=True))
    receipts = [
        guard(AgentAction(type="email.send", payload={"n": 1})).receipt,
        guard(AgentAction(type="email.send", payload={"n": 2})).receipt,
        guard(AgentAction(type="record.delete", payload={"n": 3})).receipt,
    ]

    assert receipts[0].prev_receipt_hash is None
    assert receipts[1].prev_receipt_hash == hash_receipt(receipts[0])
    assert verify_chain(receipts) == -1


def test_chain_detects_tampering():
    from suretyai.guard import GuardOptions
    from dataclasses import replace
    guard = create_guard([no_delete], GuardOptions(chain=True))
    receipts = [
        guard(AgentAction(type="email.send", payload={"n": i})).receipt
        for i in range(3)
    ]

    receipts[1] = replace(receipts[1], allowed=False)
    assert verify_chain(receipts) == 2
