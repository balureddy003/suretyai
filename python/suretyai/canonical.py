"""
Canonical JSON serialization, aligned with RFC 8785 (JCS) for the
JSON subset Surety produces: object keys are sorted recursively by
Unicode code points, so semantically identical values always serialize —
and therefore hash — identically, regardless of key insertion order
or nesting depth.
"""

from __future__ import annotations

import json
import math
from typing import Any


def canonicalize(value: Any) -> str:  # noqa: ANN401
    """Return the canonical JSON serialization of value.

    Raises TypeError for non-finite floats, functions, or any other
    type that cannot be represented in JSON.
    """
    if value is None or isinstance(value, bool):
        return json.dumps(value)
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            raise TypeError(f"Cannot canonicalize non-finite number: {value}")
        return json.dumps(value)
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, list):
        # None elements stay as null; we don't convert undefined (no concept in Python).
        return "[" + ",".join(canonicalize(v) for v in value) + "]"
    if isinstance(value, dict):
        # Sort keys lexicographically by Unicode code point (same as UTF-16 for BMP chars).
        sorted_items = sorted(
            ((k, v) for k, v in value.items() if v is not None),
            key=lambda kv: kv[0],
        )
        return (
            "{"
            + ",".join(json.dumps(k) + ":" + canonicalize(v) for k, v in sorted_items)
            + "}"
        )
    raise TypeError(f"Cannot canonicalize value of type {type(value).__name__}")
