# Bug Context — 001

## Application
**notes-api** — a minimal Express REST API for user notes, in-memory storage, single file per concern.

- Entry point: `src/index.js`
- Run: `npm start` (listens on `http://localhost:3000`)
- Tests: `npm test`

### Endpoints
| Method | Path                      | Description                          |
|--------|---------------------------|--------------------------------------|
| GET    | `/notes?page=&perPage=`   | List notes with pagination           |
| GET    | `/notes/search?q=`        | Search by title substring or tag     |
| DELETE | `/notes/:id`              | Delete a note (admin token required) |

### Seed data
5 notes — note id 5 (`'Random thoughts'`) intentionally has **no** `tags` field.

---

## Reported bugs

The following issues are reported by users and need to be investigated and fixed
by the pipeline. The Bug Researcher should locate each in the source, propose a
root cause, and the Bug Fixer should resolve them so that all tests pass.

### Bug A — Pagination returns the wrong page
- **Symptom**: `GET /notes?page=1&perPage=2` returns notes 3 and 4 instead of notes 1 and 2. `page=2&perPage=2` returns note 5 only. Every page appears shifted by one.
- **Reproduce**:
  ```bash
  npm start
  curl 'http://localhost:3000/notes?page=1&perPage=2'
  ```
- **Expected**: notes with ids `[1, 2]`
- **Actual**: notes with ids `[3, 4]`
- **Failing tests**:
  - `notes-api > GET /notes (pagination) > page=1, perPage=2 returns the first two notes`
  - `notes-api > GET /notes (pagination) > page=2, perPage=2 returns notes 3 and 4`

### Bug B — `/notes/search` returns 500 for every query
- **Symptom**: Any search query produces `HTTP 500 Internal Server Error` from the server. Server log shows `TypeError: Cannot read properties of undefined (reading 'includes')`.
- **Reproduce**:
  ```bash
  npm start
  curl -i 'http://localhost:3000/notes/search?q=Meeting'
  ```
- **Expected**: `200` with a filtered list of matching notes
- **Actual**: `500 Internal Server Error`
- **Failing tests**:
  - `notes-api > GET /notes/search > finds a note by title substring`
  - `notes-api > GET /notes/search > finds notes by tag`

---

## Baseline test run (before pipeline)
```
Test Files  1 failed (1)
     Tests  4 failed | 1 passed (5)
```
After the pipeline runs, all 5 tests should pass.

---

## Note for the Security Verifier
The Security Verifier should review the changed code from `fix-summary.md` **and**
the surrounding modules touched by the fix (e.g. anything imported by the
endpoints) and report findings independently. Issues are **not** pre-listed here
on purpose — the verifier's job is to discover them.
