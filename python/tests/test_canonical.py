import math
import pytest
from suretyai.canonical import canonicalize


def test_invariant_to_top_level_key_order():
    assert canonicalize({"b": 1, "a": 2}) == canonicalize({"a": 2, "b": 1})


def test_invariant_to_nested_key_order():
    assert canonicalize({"x": {"b": 1, "a": 2}}) == canonicalize({"x": {"a": 2, "b": 1}})


def test_never_drops_nested_keys_absent_from_top_level():
    a = canonicalize({"a": 2, "b": {"c": 1}})
    b = canonicalize({"a": 2, "b": {"c": 999}})
    assert '"c"' in a
    assert a != b


def test_arrays_preserve_order():
    assert canonicalize([3, 1, 2]) == "[3,1,2]"


def test_omits_none_values():
    assert canonicalize({"a": 1, "b": None}) == '{"a":1}'


def test_primitives():
    assert canonicalize(None) == "null"
    assert canonicalize(True) == "true"
    assert canonicalize(False) == "false"
    assert canonicalize(42.5) == "42.5"
    assert canonicalize('he said "hi"') == '"he said \\"hi\\""'


def test_raises_on_non_finite():
    with pytest.raises(TypeError):
        canonicalize(math.inf)
    with pytest.raises(TypeError):
        canonicalize(float("nan"))


def test_raises_on_unsupported_types():
    with pytest.raises(TypeError):
        canonicalize(lambda: 1)
