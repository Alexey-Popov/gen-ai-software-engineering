# CLAUDE.md — Virtual Card Lifecycle Service (homework-3)

> Workflow and style rules for Claude Code. Domain invariants, security constraints, and regulatory rules live in `../agents.md` — cross-reference there, do not duplicate here.

---

## When you edit a route

1. Check whether `agents.md §4` requires an integration test for that route type (it always does for mutations).
2. If the route is a mutation (`POST`, `PATCH`): verify that the handler writes to `audit_events` and `outbox` in the same `session.begin()` block. If it does not, flag it before writing any other code.
3. If the route is new: also update the Pydantic request/response models in `src/models/`, add a contract stub in `tests/contracts/`, and add the route to the OpenAPI summary in `docs/`.

## When you add or change a data model

1. Create a matching Alembic migration. Never mutate the DB schema without a migration.
2. Check that no new column is named `cvv`, `pan`, `full_token`, or `password` — see `agents.md §1.1`.
3. Monetary fields must use `NUMERIC(18,4)` in the migration and `Decimal` in the ORM model.

## When you add a dependency injection function

1. Add it to the appropriate module under `src/dependencies/`.
2. Ensure it fails-closed on external service failure (see `agents.md §5`).
3. Write a unit test that covers the 5xx path from the upstream service.
4. **Do not implement idempotency or rate limiting as Depends** — both are `BaseHTTPMiddleware` in `src/middleware/`. Adding `Depends(idempotency_guard)` to a route is wrong; the middleware already handles it before the route is reached.

## When you touch auth or card-data paths

1. Run `pytest -m security` before marking the task done.
2. Grep the log output of the test for PAN-length strings: `grep -E '\b[0-9]{12,}\b'` must return no matches.
3. Verify the `audit_events.diff` in the test fixture contains no `pan` or `cvv` key.

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Python modules | `snake_case` | `card_state.py` |
| Pydantic models | `PascalCase` | `CardCreate`, `TransactionRead` |
| SQLAlchemy ORM models | `PascalCase` + `ORM` suffix | `CardORM`, `AuditEventORM` |
| FastAPI route functions | `snake_case` verb-first | `issue_card`, `update_card_status` |
| FastAPI dependencies | `snake_case` `require_` prefix | `require_auth`, `require_kyc_approved` |
| Enum values | `UPPER_SNAKE_CASE` | `ACTIVE`, `FRAUD_FREEZE_REQUESTED` |
| Error codes (envelope) | `UPPER_SNAKE_CASE` | `CARDHOLDER_NOT_VERIFIED` |
| Kafka topic names | `entity.past_tense_verb` | `card.issued`, `card.state_changed` |
| Test files | `test_<module>.py` | `test_cards.py`, `test_limit_enforcement.py` |

## What to avoid

- **Do not** use `float` for any monetary value.
- **Do not** use `datetime.now()` without `timezone.utc`.
- **Do not** construct SQL with f-strings or `%` formatting — use SQLAlchemy bound parameters.
- **Do not** add a `print()` statement for debugging — use `StructuredLogger` from `src/observability/logging.py`.
- **Do not** commit secrets, API keys, or connection strings — use `src/config.py` (`Settings`).
- **Do not** write a `downgrade()` body for the `audit_events` migration.
- **Do not** catch and silently swallow `Exception` — let unhandled exceptions surface to the registered handlers.

## PR / commit conventions

- Commit message: `<type>(<scope>): <imperative sentence>` — e.g. `feat(cards): add freeze endpoint with processor propagation`.
- Every PR touching a mutation endpoint must include an integration test that asserts an `audit_events` row.
- Every PR touching auth or card-data paths must include a security-mark test.

## Useful references

- Domain + security rules: `../agents.md`
- Full specification (tasks, edge cases, verification): `../specification.md`
- Test strategy: `../docs/test-strategy.md` (created by Task X.4)
- Load-test plan: `../docs/load-test-plan.md` (created by Task 6.2)
