# Screenshots

These render in the main [`../../README.md`](../../README.md).

## Added — AI‑assisted development (planning phase)

| File | Content |
|------|---------|
| `1.png` | Kick‑off: reading the homework + researching Anthropic best practices |
| `2.png` | Claude delivers `PROMPT.md` (engineered backend prompt) |
| `3.png` | Request for an Angular 20 frontend; research + `PROMPT-FRONTEND.md` |
| `4.png` | Frontend prompt contents + request for a TDD plan |
| `5.png` | `PLAN-BACKEND-TDD.md` — Red→Green→Refactor, 10 cycles |
| `6.png` | Environment check + cycle‑by‑cycle workflow, Cycle 0 begins |

## Added — AI‑assisted development (TDD cycles)

| File | Content |
|------|---------|
| `7.png` | Cycle 0 delivered (walking skeleton, first 2 tests), verify locally |
| `8.png` | Cycle 0 green → move backend into `backend/` + prompt rule, then Cycle 1 |
| `9.png` | Cycle 1 implemented test‑first (model, repo, service, endpoints, 404) |
| `10.png` | "9 tests passed" → Cycle 2 (validation + structured 400) begins |

## Added — quick start

| File | Content |
|------|---------|
| `21.png` | `./run.sh` running — FastAPI backend + Electron desktop app live (the full stack) |

## Added — tests & backend running

| File | Content |
|------|---------|
| `11.png` | `mvn test` — all 53 tests green (`Tests run: 53, Failures: 0`, `BUILD SUCCESS`) |
| `12.png` | `mvn spring-boot:run` — `Tomcat started on port 3000`, `Started BankingApplication` |

## Added — API, docs & health

| File | Content |
|------|---------|
| `13.png` | `curl` responses: transactions list, balance, summary (JSON) |
| `14.png` | Scalar API reference at `http://localhost:3000/docs` |
| `15.png` | `http://localhost:3000/actuator/health` → `{"status":"UP", ...}` |

## Added — frontend (Microsoft Fluent)

| File | Content |
|------|---------|
| `16.png` | Transactions UI with data, filters, badges, API‑status chip (dark theme) |
| `17.png` | The same view in light theme |
| `18.png` | "New transaction" form with per‑field validation errors |
| `19.png` | Account tools page: balance, summary, simple‑interest calculators |
| `20.png` | CSV export downloaded and opened in a spreadsheet |

✅ All README screenshots are in place (`1.png`–`20.png`).
