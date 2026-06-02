# Skill: repo-audit

Audit this homework repository from 0 to 100 — understand what's here,
then verify any runnable code that exists.

## Step 1 — Map the repo

```bash
find . -not -path '*/.git/*' -type f | sort
```

Report what homework folders exist and which ones have actual source code
vs. placeholder `.gitkeep` files.

## Step 2 — Read task descriptions

For each homework folder that exists, read its `TASKS.md` (and `README.md`
if present) to understand what was supposed to be built.

## Step 3 — Check for runnable code

For each `src/` directory that is NOT empty:
- Identify the language/framework from file extensions and package files
  (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, etc.)
- Read `HOWTORUN.md` (if present) for launch instructions
- Attempt to install dependencies and start the application

## Step 4 — Verify each runnable homework

For each homework with a live application, follow the `/verify` protocol:

1. **Identify the surface** — CLI, HTTP server, GUI, library
2. **Launch it** using the instructions from `HOWTORUN.md` or package scripts
3. **Drive the golden path** — the main feature the task description asks for
4. **Probe edges** — empty inputs, missing fields, bad values, duplicate calls
5. **Capture output** — stdout, HTTP responses, or screenshots as evidence

## Step 5 — Report

Produce a table like:

| Homework | Status | Surface | Notes |
|----------|--------|---------|-------|
| homework-1 | SKIP | — | src/ is empty |
| homework-2 | PASS | HTTP API | All endpoints respond correctly |
| homework-3 | FAIL | CLI | Crashes on empty input |

Then list findings per homework using:
- ✅ working as described
- ❌ broken / missing
- ⚠️ works but notable issue
- 🔍 probe result (edge case tested)

## Verdict rules

- **PASS** — launched the app, golden path works, no critical failures
- **FAIL** — app launched but the claimed feature doesn't work, or it crashes
- **BLOCKED** — couldn't launch (missing dep, broken build, no instructions)
- **SKIP** — no source code present (template / placeholder only)

If ALL homeworks are SKIP, say so clearly and tell the user which homework
to implement first.
