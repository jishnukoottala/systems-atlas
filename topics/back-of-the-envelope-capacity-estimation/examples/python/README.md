# Capacity estimator (Python and FastAPI)

Returns every step with its formula and unit, so a reviewer can find a wrong assumption quickly.

```bash
uv run pytest -q
uv run python -m app.main
uv run uvicorn app.main:app --port 8000
```

```bash
curl -s localhost:8000/estimate -H 'content-type: application/json' -d '{"daily_active_users":1000000,"writes_per_user_per_day":2,"reads_per_user_per_day":50,"object_size_bytes":2000,"response_size_bytes":4000}' | jq .summary
```

Educational limits: per-server capacity and peak ratios are inputs, and the tool cannot tell whether they
are right. Storage ignores indexes, compression, and overhead.
