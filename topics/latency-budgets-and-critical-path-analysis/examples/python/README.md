# Budget arithmetic with distributions (Python)

A seeded Monte Carlo simulation showing how percentiles combine across sequential, parallel, and
correlated calls, and how a deadline bounds total time. There is no HTTP layer, as this is analysis.

```bash
uv run pytest -q
uv run python -m app.main
```

Educational limits: lognormal shapes and a simple correlation model. Fit real distributions from traces.
