# How percentile numbers go wrong (Python)

Seeded demonstrations of averaging percentiles, small samples, bucket choice, and window choice. There
is no HTTP layer, since this is analysis.

```bash
uv run pytest -q
uv run python -m app.main
```

Educational limits: lognormal data is a convenient approximation. Real latency is often multimodal.
