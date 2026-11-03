# Operational analysis (Python)

Applies the utilization law and bottleneck bound to measured service demands, so you can predict the limit
before running a load test. No HTTP layer, as it is a calculator.

```bash
uv run pytest -q
uv run python -m app.main
```

Educational limits: demand values are illustrative, and they can change with load, for example through cache
behavior or lock contention. Treat the bound as an upper limit and confirm it with a test.
