# Throughput and goodput simulation (Python)

A seeded discrete-event simulation of a 1,000 request-per-second pool. There is no HTTP layer, because
the point is the queueing behavior, and real timers would make it slow and flaky.

```bash
uv run pytest -q
uv run python -m app.main
uv run python -m app.main --queue-limit 50
```

Educational limits: exponential service times, a single shared queue, and no client retries, so real
overload can be worse than shown here.
