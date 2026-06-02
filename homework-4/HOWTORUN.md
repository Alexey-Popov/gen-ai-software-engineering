# How to Run the Pipeline

## Prerequisites

1. **Claude CLI** installed and authenticated:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude login
   ```

2. **.NET 9.0 SDK** installed:
   ```bash
   dotnet --version   # must be 9.0.x or later
   ```

3. **Bash** available (Git Bash, WSL, or macOS/Linux terminal).  
   On Windows with PowerShell, run inside Git Bash or WSL.

4. The solution must build cleanly before running the pipeline:
   ```bash
   dotnet build AiTicketHub.sln
   ```

---

## Run the Full Pipeline

**Windows (PowerShell)** — recommended on Windows:
```powershell
.\run-pipeline.ps1
```

**macOS / Linux / Git Bash / WSL:**
```bash
chmod +x run-pipeline.sh
./run-pipeline.sh
```

The script runs 6 steps in sequence and exits immediately on any failure:

| Step | What happens |
|------|-------------|
| 1 | Bug Researcher scans all `.cs` source files and writes `context/bugs/001/codebase-research.md` |
| 2 | Research Verifier checks every `file:line` reference and writes `context/bugs/001/verified-research.md` |
| 3 | Bug Planner reads the verified findings and writes `context/bugs/001/implementation-plan.md` |
| 4 | Bug Fixer applies each change, runs `dotnet test` after each, writes `context/bugs/001/fix-summary.md` |
| 5 | Security Verifier reviews changed files and writes `context/bugs/001/security-report.md` |
| 6 | Unit Test Generator writes new test files and `context/bugs/001/test-report.md` |

Typical runtime: 5–15 minutes depending on model response times.

---

## Expected Output

After the pipeline completes:

```
context/bugs/001/
├── codebase-research.md
├── verified-research.md
├── implementation-plan.md
├── fix-summary.md
├── security-report.md
└── test-report.md
```

Source files under `src/AiTicketHub/` will be modified in-place by the Bug Fixer.  
New test files will be added under `tests/AiTicketHub.Tests/`.

---

## Verify the Results

```bash
# Confirm all tests pass after the pipeline
dotnet test AiTicketHub.sln

# Start the fixed API and open Swagger
dotnet run --project src/AiTicketHub/API
# → http://localhost:5000/swagger
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `claude: command not found` | Install Claude CLI: `npm install -g @anthropic-ai/claude-code` |
| `claude login` fails | Check your Anthropic API key or re-run `claude login` |
| Pipeline stops at Step 4 with `FAIL` | Read `context/bugs/001/fix-summary.md` — the Overall Status section shows which change failed and the first error line from `dotnet test` |
| `dotnet build` fails before pipeline starts | Run `dotnet restore AiTicketHub.sln` then retry |
| Script not executable on macOS/Linux | Run `chmod +x run-pipeline.sh` |

---

## Running Individual Agents Manually

If you want to re-run a single step without the full pipeline:

```bash
# Example: re-run the Security Verifier only
claude -p \
  --model claude-opus-4-5 \
  --agent agents/security-verifier.agent.md \
  --permission-mode bypassPermissions \
  --allowedTools "Read,Write" \
  "Read context/bugs/001/fix-summary.md and write context/bugs/001/security-report.md."
```
