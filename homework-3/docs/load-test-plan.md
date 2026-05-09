# Load Test Plan — Virtual Card Lifecycle Service

> Produced by Task 6.2. SLO targets are sourced from `specification.md §3`. Run these scenarios with k6 before each major release. Pass/fail thresholds encode the NFR targets.

---

## 1. Workload Model

Steady-state traffic distribution (modelled on a mid-size consumer FinTech with ~50 k active cards):

| Operation | Share | Endpoint |
|---|---|---|
| Read card list / detail | 40% | `GET /cards`, `GET /cards/{token}` |
| Read transactions | 38% | `GET /cards/{token}/transactions` |
| Freeze / unfreeze | 5% | `PATCH /cards/{token}/status` |
| Limit update | 4% | `PATCH /cards/{token}/limits` |
| Card issue | 2% | `POST /cards` |
| Audit / ops reads | 6% | `GET /audit/events` |
| Webhook ingest | 5% | `POST /webhooks/processor` |

End-of-month billing spike: 2× overall volume; freeze traffic up to 3× baseline (cardholders locking cards to dispute charges).

---

## 2. SLO Targets (from `specification.md §3`)

| Metric | Target | Rationale |
|---|---|---|
| `GET` endpoints — p95 latency | < 300 ms | `[ASSUMED]` — comfortable above FastAPI + Postgres baseline (≈ 50 ms), with headroom for joins at scale |
| `POST`/`PATCH` endpoints — p95 latency | < 800 ms | `[ASSUMED]` — accounts for processor API round-trip ≈ 200 ms |
| Freeze propagation (`PATCH status=FROZEN`) — p99 latency | ≤ 2 000 ms | ISO 8583 / card-network issuer-response window (Visa/Mastercard require issuer response within ≈ 2 s) |
| Service availability — reads | ≥ 99.9% | `[ASSUMED]` — standard SaaS SLO |
| Service availability — freeze endpoint | ≥ 99.95% | `[ASSUMED]` — safety-critical path; higher bar than general writes |
| Error rate (5xx) | < 0.1% | `[ASSUMED]` — aligns with p95 availability targets above |

---

## 3. Tooling

- **k6** (preferred for scripted, code-based scenarios with threshold assertions)
- Metrics exported to Prometheus via `k6-prometheus-remote-write` extension
- Traces correlated via `X-Request-ID` headers

---

## 4. Ramp Profile

```
VUs:  10 ──► 100 ──────────────► 500 ──► 100 ──► 0
      │      │                   │       │
      0     2 min               8 min  10 min  12 min

Stage 1 (0–2 min):   ramp from 10 to 100 VUs  — warm up, confirm baseline
Stage 2 (2–8 min):   hold at 100 VUs          — steady-state measurement window
Stage 3 (8–10 min):  ramp from 100 to 500 VUs — end-of-month spike simulation
Stage 4 (10–12 min): ramp down to 0            — cooldown, confirm no residual errors
```

Freeze endpoint tested separately (see Scenario 4) to isolate its p99 signal from read traffic.

---

## 5. Scenarios

### Scenario 1 — Steady-state read mix

Simulates the 78% read workload (card list + transactions).

```javascript
// k6 threshold: p(95) < 300
thresholds: {
  'http_req_duration{endpoint:cards_list}': ['p(95)<300'],
  'http_req_duration{endpoint:transactions_list}': ['p(95)<300'],
}
```

Seed: `fixture_locust_seed_50_active_cards` (50 cardholders × 1 000 transactions each).

### Scenario 2 — Write mix with idempotency

Simulates card issue, limit update, and freeze with a 10% duplicate-request rate (same `Idempotency-Key`).

```javascript
thresholds: {
  'http_req_duration{endpoint:issue_card}': ['p(95)<800'],
  'http_req_duration{endpoint:update_limit}': ['p(95)<800'],
  // Duplicate requests must return same status code as original
  'checks': ['rate>0.99'],
}
```

### Scenario 3 — Rate limiter activation

11 write requests per cardholder per minute — 11th must return 429.

```javascript
thresholds: {
  'checks{check:11th_write_is_429}': ['rate==1.0'],
  'http_req_duration': ['p(95)<800'],
}
```

### Scenario 4 — Freeze latency probe (safety-critical)

Isolated freeze scenario: single cardholder, 500 concurrent freeze/unfreeze cycles. Measures freeze propagation p99 against the 2 000 ms target.

```javascript
thresholds: {
  'http_req_duration{endpoint:freeze}': ['p(99)<2000'],
  'checks{check:freeze_status_frozen}': ['rate>0.999'],
}
```

This scenario is the **blocking gate** — if p99 freeze latency exceeds 2 000 ms, the release is held.

---

## 6. Acceptance Criteria

| Scenario | Gate condition |
|---|---|
| 1 — Read mix | p95 < 300 ms across all read endpoints |
| 2 — Write mix | p95 < 800 ms; idempotency check rate > 99% |
| 3 — Rate limiter | 100% of 11th-write requests return 429 |
| 4 — Freeze probe | **p99 ≤ 2 000 ms** (hard gate); error rate < 0.1% |

All four scenarios must pass before a production release is approved.
