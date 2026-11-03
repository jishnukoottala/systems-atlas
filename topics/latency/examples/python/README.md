# Latency from first principles (Python)

Computes propagation, transmission, and queueing delay. There is no HTTP layer, as this is a calculator.

```bash
uv run pytest -q
uv run python -m app.main
uv run python -m app.main --km 16000 --mbps 50 --bytes 50000
```

Educational limits: the route factor of 1.4 is illustrative, and M/D/1 assumes random arrivals with
fixed service time. Real networks add routers, retransmission, and congestion.
