#!/usr/bin/env bash
#
# 6-agent bug-fix pipeline runner.
# Runs a single Claude Code orchestrator session that dispatches all subagents
# in order via the Agent tool, with stop conditions between steps.
#
# Usage:
#   ./run-pipeline.sh                 # uses BUG_ID=001
#   BUG_ID=002 ./run-pipeline.sh      # different bug bundle
#
# Prerequisites:
#   - claude CLI installed and authenticated (see https://docs.claude.com/claude-code)
#   - ANTHROPIC_API_KEY (or Pro/Team subscription via `claude /login`)
#   - Node.js >= 20 and `npm install` already run (Bug Fixer runs `npm test`)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

BUG_ID="${BUG_ID:-001}"
BUG_DIR="context/bugs/$BUG_ID"

# ---- Sanity checks ----------------------------------------------------------

if [[ ! -f "$BUG_DIR/bug-context.md" ]]; then
  echo "ERROR: Missing $BUG_DIR/bug-context.md"
  echo "       Expected the bug bundle to be set up before running the pipeline."
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: 'claude' CLI not found on PATH."
  echo "       Install Claude Code: https://docs.claude.com/claude-code"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "ERROR: node_modules/ missing. Run 'npm install' first."
  exit 1
fi

# ---- Sync agents and skills into .claude/ so subagents are discoverable -----

mkdir -p .claude/agents .claude/skills
for f in agents/*.agent.md; do
  base="$(basename "$f" .agent.md)"
  cp "$f" ".claude/agents/$base.md"
done
cp skills/*.md .claude/skills/ 2>/dev/null || true

echo "Pipeline starting for BUG_ID=$BUG_ID"
echo "Artifacts will be written under $BUG_DIR/"
echo

# ---- Run the orchestrator ---------------------------------------------------

ORCHESTRATOR_PROMPT="$(cat <<EOF
You are the orchestrator of the 6-agent bug-fix pipeline.

BUG_ID=$BUG_ID
Artifact directory: $BUG_DIR

Run the following subagents IN ORDER via the Agent tool. After each subagent
completes, verify the expected output file exists; if missing, halt with a
clear error message and do not proceed.

Steps:
  1. subagent_type=bug-researcher
     Required output: $BUG_DIR/research/codebase-research.md
  2. subagent_type=research-verifier
     Required output: $BUG_DIR/research/verified-research.md
     STOP CONDITION: if the file contains "Pipeline action: STOP", halt.
  3. subagent_type=bug-planner
     Required output: $BUG_DIR/implementation-plan.md
     STOP CONDITION: if the plan starts with "BLOCKED", halt.
  4. subagent_type=bug-fixer
     Required output: $BUG_DIR/fix-summary.md (and edits in src/)
     STOP CONDITION: if Overall Status is "failed", halt.
  5. subagent_type=security-verifier
     Required output: $BUG_DIR/security-report.md
     (Does not halt the pipeline regardless of findings.)
  6. subagent_type=unit-test-generator
     Required output: $BUG_DIR/test-report.md (and new tests/*.test.js files)

Before each step, print exactly:  ">> <agent-name> starting"
After each step, print exactly:   "<< <agent-name> done"

At the very end, print:
  ARTIFACTS:
    $BUG_DIR/research/codebase-research.md
    $BUG_DIR/research/verified-research.md
    $BUG_DIR/implementation-plan.md
    $BUG_DIR/fix-summary.md
    $BUG_DIR/security-report.md
    $BUG_DIR/test-report.md
EOF
)"

claude -p \
  --permission-mode bypassPermissions \
  --allowed-tools "Agent,Read,Write,Edit,Bash,Grep,Glob" \
  "$ORCHESTRATOR_PROMPT"

echo
echo "Orchestrator session ended."
echo
echo "Artifacts present in $BUG_DIR/:"
ls -la "$BUG_DIR/" 2>/dev/null || true
echo
if [[ -d "$BUG_DIR/research" ]]; then
  echo "Research artifacts:"
  ls -la "$BUG_DIR/research/" 2>/dev/null || true
fi
