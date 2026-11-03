# Requirement evidence checker (Python)

Compares measurements with quality requirements. Evidence gathered below the required load or over
too short a window yields `inconclusive`, not `met`. No HTTP layer: the lesson is the evaluation.

```bash
uv run pytest -q
uv run python -m app.main
```

Exit codes: 0 means all met, 1 means at least one not met, 2 means an invalid spec.

Educational limits: a real system pulls measurements from a metrics store and handles aggregation
correctly. Percentiles cannot be averaged across windows.
