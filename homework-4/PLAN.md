# 4-Agent Pipeline Plan

## File Structure

```
homework-4/
├── agents/
│   ├── research-verifier.agent.md
│   ├── bug-fixer.agent.md
│   ├── security-verifier.agent.md
│   └── unit-test-generator.agent.md
├── skills/
│   ├── research-quality-measurement.md
│   └── unit-tests-FIRST.md
├── context/
│   └── bugs/
│       └── 001/                        ← populated entirely by agent output
├── docs/
│   └── screenshots/
├── run-pipeline.sh
├── README.md
└── HOWTORUN.md
```

---

## Pipeline Steps

The script runs 6 sequential steps. Steps 1 and 3 are inline `claude -p` invocations (no agent file). Steps 2, 4, 5, 6 each invoke a dedicated `.agent.md` agent. The pipeline exits on the first failure.

| Step | Label | Style | Output file |
|------|-------|-------|-------------|
| 1 | Bug Researcher | inline `claude -p` | `codebase-research.md` |
| 2 | Research Verifier | `research-verifier.agent.md` | `verified-research.md` |
| 3 | Bug Planner | inline `claude -p` | `implementation-plan.md` |
| 4 | Bug Fixer | `bug-fixer.agent.md` | `fix-summary.md` + modified source files |
| 5 | Security Verifier | `security-verifier.agent.md` | `security-report.md` |
| 6 | Unit Test Generator | `unit-test-generator.agent.md` | `test-report.md` + new test files |

---

## Agent Details

### Step 1 — Bug Researcher (inline)

**Role:** Reads every `.cs` file under `src/AiTicketHub/` and documents all suspicious findings — logic errors, state-machine gaps, hardcoded values, missing validation.

**Files read:** All `.cs` files in `Domain/`, `Application/`, `Infrastructure/`, `API/`.

**File written:** `context/bugs/001/codebase-research.md`
- Structured list of findings, each with exact `file:line`, quoted snippet, and short description.

**Model:** `claude-sonnet-4-5`
- Justification: Reading and summarising code is a straightforward comprehension task; mid-tier is fast and cost-effective.

---

### Step 2 — Research Verifier (`agents/research-verifier.agent.md`)

**Role:** Fact-checks every claim in `codebase-research.md`. Re-opens each cited file, confirms the line number matches the quoted snippet, marks each claim Verified or Discrepant. Scores overall research quality using the Research Quality Measurement skill.

**Files read:**
- `context/bugs/001/codebase-research.md`
- `skills/research-quality-measurement.md` (via skill directive in frontmatter)
- Every source file cited in `codebase-research.md`

**File written:** `context/bugs/001/verified-research.md`

Required sections:
```
## Verification Summary       (pass/fail count, quality level per skill)
## Verified Claims            (each confirmed finding)
## Discrepancies Found        (wrong line numbers, misquoted snippets)
## Research Quality Assessment (level label + reasoning)
## References                 (canonical file:line list)
```

**Model:** `claude-opus-4-5`
- Justification: Verification is a precision reasoning task — the model must not hallucinate agreement. The stronger model reduces false confirmation risk.

---

### Skill: `skills/research-quality-measurement.md`

Defines four quality levels used by the Research Verifier:

| Level | Criteria |
|-------|----------|
| **Excellent** | ≥ 90% of claims verified, no critical discrepancies |
| **Adequate** | 70–89% verified, only minor discrepancies |
| **Insufficient** | 50–69% verified, or any claim with wrong file path |
| **Rejected** | < 50% verified, or fabricated snippets found |

The verifier must select exactly one level and justify it in the Quality Assessment section.

---

### Step 3 — Bug Planner (inline)

**Role:** Reads `verified-research.md` and produces a concrete, per-file implementation plan with exact before/after code blocks and the test command to run after each change.

**Files read:** `context/bugs/001/verified-research.md`, each source file listed in Verified Claims.

**File written:** `context/bugs/001/implementation-plan.md`

**Model:** `claude-sonnet-4-5`
- Justification: Planning is a structured writing task from already-verified inputs; mid-tier is sufficient.

---

### Step 4 — Bug Fixer (`agents/bug-fixer.agent.md`)

**Role:** Reads `implementation-plan.md`, applies each change to the actual source file, runs `dotnet test` after every individual change. If tests fail it stops and records the failure without attempting self-repair.

**Files read:**
- `context/bugs/001/implementation-plan.md`
- Each source file listed in the plan

**Files written:**
- Modified source files (in-place edits to `src/AiTicketHub/...`)
- `context/bugs/001/fix-summary.md`

Required sections in `fix-summary.md`:
```
## Changes Made               (file, location, before snippet, after snippet, test result)
## Overall Status             (all-pass / partial / failed)
## Manual Verification Steps  (curl examples or run commands to confirm)
## References                 (implementation-plan.md → source file mapping)
```

**Model:** `claude-sonnet-4-5`
- Justification: Applying known, well-specified code edits and running a test command is routine; no deep reasoning needed.

---

### Step 5 — Security Verifier (`agents/security-verifier.agent.md`)

**Role:** Reads `fix-summary.md` to identify every changed file. Scans each for hardcoded secrets, injection vectors (SQL, command, XML), insecure comparisons, missing input validation, unsafe dependencies, CSRF/XSS risks. Rates each finding CRITICAL / HIGH / MEDIUM / LOW / INFO. Writes a report only — never edits source code.

**Files read:**
- `context/bugs/001/fix-summary.md`
- Every changed source file listed in it

**File written:** `context/bugs/001/security-report.md`

Required sections:
```
## Executive Summary          (finding counts by severity)
## Findings                   (per finding: severity, file:line, description, remediation)
## OWASP Mapping              (maps each finding to an OWASP Top 10 category)
## Scope                      (files reviewed, files not reviewed)
```

**Model:** `claude-opus-4-5`
- Justification: Security review requires nuanced judgment about threat models and false-positive avoidance. The strongest model minimises missed vulnerabilities.

---

### Step 6 — Unit Test Generator (`agents/unit-test-generator.agent.md`)

**Role:** Reads `fix-summary.md` to find changed code units. For each changed method/class, generates NUnit 4 tests following the FIRST skill and the project's existing test conventions (FluentAssertions, Moq, `WebApplicationFactory<Program>`). Runs `dotnet test` and records results.

**Files read:**
- `context/bugs/001/fix-summary.md`
- Each changed source file
- `skills/unit-tests-FIRST.md` (via skill directive in frontmatter)
- Existing test files in `tests/AiTicketHub.Tests/` (to match naming and style)

**Files written:**
- New or updated `.cs` test files in `tests/AiTicketHub.Tests/`
- `context/bugs/001/test-report.md`

Required sections in `test-report.md`:
```
## Summary                    (total tests generated, pass count, fail count)
## Generated Tests            (class name, test name, what it covers, FIRST compliance note)
## Test Run Output            (verbatim dotnet test output)
## Coverage Notes             (which changed methods now have test coverage)
```

**Model:** `claude-sonnet-4-5`
- Justification: Test scaffolding is pattern-repetitive; mid-tier is fast and accurate at following the project's existing style.

---

### Skill: `skills/unit-tests-FIRST.md`

Defines the FIRST principles that every generated test must satisfy:

| Letter | Principle | Requirement |
|--------|-----------|-------------|
| **F** | Fast | Each test completes in < 100 ms; no I/O or sleep |
| **I** | Independent | Tests do not share state; no ordering dependency |
| **R** | Repeatable | Same result every run; all non-determinism mocked |
| **S** | Self-validating | Uses a FluentAssertions `.Should()` call; no `Console.WriteLine` |
| **T** | Timely | Tests only code changed by the Bug Fixer in this pipeline run |

Each generated test class must include a `// FIRST: F✓ I✓ R✓ S✓ T✓` comment block explaining any partial compliance.

---

## `run-pipeline.sh` Invocation

```bash
#!/usr/bin/env bash
set -euo pipefail

BUG_ID="001"
CTX="context/bugs/${BUG_ID}"
SRC="src/AiTicketHub"

# ── Step 1: Bug Researcher (inline) ──────────────────────────────────────────
echo "[1/6] Bug Researcher..."
claude -p \
  --model claude-sonnet-4-5 \
  "Read all .cs source files under ${SRC}. For each suspicious finding record
   file path, line number, quoted snippet, and a short description.
   Write your findings to ${CTX}/codebase-research.md." \
  --allowedTools "Read,Write,Glob"

# ── Step 2: Research Verifier (agent) ────────────────────────────────────────
echo "[2/6] Research Verifier..."
claude -p \
  --model claude-opus-4-5 \
  --agent agents/research-verifier.agent.md \
  "Verify the bug research in ${CTX}/codebase-research.md
   and write ${CTX}/verified-research.md." \
  --allowedTools "Read,Write"

# ── Step 3: Bug Planner (inline) ─────────────────────────────────────────────
echo "[3/6] Bug Planner..."
claude -p \
  --model claude-sonnet-4-5 \
  "Read ${CTX}/verified-research.md. For each verified claim produce an
   implementation plan with exact before/after code and test commands.
   Write to ${CTX}/implementation-plan.md." \
  --allowedTools "Read,Write"

# ── Step 4: Bug Fixer (agent) ────────────────────────────────────────────────
echo "[4/6] Bug Fixer..."
claude -p \
  --model claude-sonnet-4-5 \
  --agent agents/bug-fixer.agent.md \
  "Apply the plan in ${CTX}/implementation-plan.md and write
   ${CTX}/fix-summary.md." \
  --allowedTools "Read,Write,Edit,Bash"

# ── Step 5: Security Verifier (agent) ────────────────────────────────────────
echo "[5/6] Security Verifier..."
claude -p \
  --model claude-opus-4-5 \
  --agent agents/security-verifier.agent.md \
  "Review changed code from ${CTX}/fix-summary.md and write
   ${CTX}/security-report.md." \
  --allowedTools "Read,Write"

# ── Step 6: Unit Test Generator (agent) ──────────────────────────────────────
echo "[6/6] Unit Test Generator..."
claude -p \
  --model claude-sonnet-4-5 \
  --agent agents/unit-test-generator.agent.md \
  "Generate tests for code changed per ${CTX}/fix-summary.md and write
   ${CTX}/test-report.md." \
  --allowedTools "Read,Write,Edit,Bash"

echo ""
echo "Pipeline complete. Outputs in ${CTX}/"
```

`--allowedTools` is kept minimal per step so agents cannot overstep their scope. `Bash` is only granted to steps that must run `dotnet test`.

---

## `context/bugs/001/` After the Full Pipeline

```
context/bugs/001/
├── codebase-research.md      ← Step 1: raw findings with file:line + snippet
├── verified-research.md      ← Step 2: fact-checked claims + quality level
├── implementation-plan.md    ← Step 3: per-change before/after + test command
├── fix-summary.md            ← Step 4: applied diffs + dotnet test results
├── security-report.md        ← Step 5: severity table + OWASP mapping
└── test-report.md            ← Step 6: generated tests + dotnet test output
```

All files are created by agents. No hand-written files exist in this folder before the pipeline runs.
