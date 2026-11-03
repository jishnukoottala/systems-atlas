# Trace generator and characterizer (Python)

Generates a seeded synthetic trace, then reports rates, peak-to-mean ratio, read ratio, key skew, and
size percentiles. No HTTP layer, since this is a batch analysis.

```bash
uv run pytest -q
uv run python -m app.main
uv run python -m app.main --zipf 0
uv run python -m app.main --export /tmp/trace.ndjson
```

Educational limits: the trace is synthetic, so it only shows method. Real traces have correlations
between keys, sizes, and time that this generator does not model.
