"""
Surety AI — the open trust layer for autonomous AI agents.

Every consequential action passes through deterministic gates,
stays inside hard budget breakers, and leaves a tamper-evident receipt.
https://github.com/balureddy003/suretyai
"""

from suretyai.canonical import canonicalize
from suretyai.guard import (
    SPEC_VERSION,
    create_guard,
    hash_payload,
    hash_receipt,
    verify_chain,
    Guard,
    GuardOptions,
)
from suretyai.limits import BondLimits, BondLimitsConfig
from suretyai.types import (
    ActionReceipt,
    AgentAction,
    GuardResult,
    GuardRule,
    ReceiptOutcome,
)

__version__ = "0.1.0"

__all__ = [
    "canonicalize",
    "SPEC_VERSION",
    "create_guard",
    "hash_payload",
    "hash_receipt",
    "verify_chain",
    "Guard",
    "GuardOptions",
    "BondLimits",
    "BondLimitsConfig",
    "ActionReceipt",
    "AgentAction",
    "GuardResult",
    "GuardRule",
    "ReceiptOutcome",
    "__version__",
]
