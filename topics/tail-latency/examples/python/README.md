# Tail amplification simulation (Python)

Shows how fan-out turns a rare slow leaf into a common slow request, and compares hedging and partial
results. No HTTP layer, as simulated time gives repeatable results.

```bash
uv run pytest -q
uv run python -m app.main
```

Educational limits: leaf delays here are independent. In production, slowness correlates, for example
through a shared disk or an overloaded host, and that weakens hedging.
