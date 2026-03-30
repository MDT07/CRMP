from __future__ import annotations

from typing import Any

from app.models.automation_rule import AutomationRule
from app.models.event import Event


class RulesEngine:
    def matches(self, rule: AutomationRule, event: Event) -> bool:
        if not rule.is_active or rule.event_type != event.event_type:
            return False
        return self._evaluate_conditions(rule.conditions, event.payload)

    def _evaluate_conditions(self, conditions: dict[str, Any], payload: dict[str, Any]) -> bool:
        if not conditions:
            return True
        for field, expected in conditions.items():
            actual = payload.get(field)
            if isinstance(expected, dict):
                operator = expected.get("operator", "eq")
                value = expected.get("value")
                if not self._compare(operator, actual, value):
                    return False
                continue
            if actual != expected:
                return False
        return True

    def _compare(self, operator: str, actual: Any, expected: Any) -> bool:
        if operator == "eq":
            return actual == expected
        if operator == "ne":
            return actual != expected
        if operator == "gt":
            return actual is not None and actual > expected
        if operator == "gte":
            return actual is not None and actual >= expected
        if operator == "lt":
            return actual is not None and actual < expected
        if operator == "lte":
            return actual is not None and actual <= expected
        if operator == "contains":
            return expected in actual if actual is not None else False
        if operator == "in":
            return actual in expected if expected is not None else False
        return False
