# Sensitivity analysis (Python)

Finds which assumption swings required capacity most, and whether its range crosses a threshold
where the design has to change. No HTTP layer, since this is a calculation.

```bash
uv run pytest -q
uv run python -m app.main
```

Educational limits: varying one input at a time ignores correlated inputs. For instance, user count
and peak ratio may move together. The model and the threshold are illustrative.
