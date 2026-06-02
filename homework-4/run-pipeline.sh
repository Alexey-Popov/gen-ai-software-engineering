#!/usr/bin/env bash
# run-pipeline.sh — single-command 4-agent bug pipeline for AiTicketHub
# Usage: ./run-pipeline.sh
# Requires: claude CLI installed and authenticated

set -euo pipefail

# ─── Setup ────────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUG_ID="001"
CTX="${REPO_ROOT}/context/bugs/${BUG_ID}"
SRC="${REPO_ROOT}/src/AiTicketHub"

cd "${REPO_ROOT}"
mkdir -p "${CTX}"

echo "================================================"
echo " AiTicketHub 4-Agent Bug Pipeline"
echo " Repo:    ${REPO_ROOT}"
echo " Context: ${CTX}"
echo "================================================"
echo ""

# ─── Step 1: Bug Researcher (inline) ─────────────────────────────────────────
echo "[1/6] Bug Researcher — scanning source for bugs..."
claude -p \
  --model claude-sonnet-4-5 \
  --permission-mode bypassPermissions \
  --allowedTools "Read,Write,Glob,LS" \
  "Read every .cs source file under ${SRC}.
   For each suspicious finding — logic errors, state-machine gaps, hardcoded values,
   missing input validation, or security issues — record:
     - Finding ID (BUG-001, BUG-002, ...)
     - File path relative to the repo root
     - Line number
     - Quoted snippet (exact, from file)
     - One-sentence description of why it is suspicious
   Write all findings to ${CTX}/codebase-research.md."
echo "  → ${CTX}/codebase-research.md"
echo ""

# ─── Step 2: Research Verifier (agent) ───────────────────────────────────────
echo "[2/6] Research Verifier — fact-checking every finding..."
claude -p \
  --model claude-opus-4-5 \
  --agent "${REPO_ROOT}/agents/research-verifier.agent.md" \
  --permission-mode bypassPermissions \
  --allowedTools "Read,Write" \
  "Verify every claim in ${CTX}/codebase-research.md against the actual source files.
   Use the skill in ${REPO_ROOT}/skills/research-quality-measurement.md to score quality.
   Write your results to ${CTX}/verified-research.md."
echo "  → ${CTX}/verified-research.md"
echo ""

# ─── Step 3: Bug Planner (inline) ────────────────────────────────────────────
echo "[3/6] Bug Planner — producing implementation plan..."
claude -p \
  --model claude-sonnet-4-5 \
  --permission-mode bypassPermissions \
  --allowedTools "Read,Write" \
  "Read ${CTX}/verified-research.md.
   For every entry in the References section, produce a numbered change entry with:
     - Change ID (matching the Finding ID)
     - Target file path (relative to repo root)
     - Before block: the exact current code to replace
     - After block: the corrected replacement code
     - Test command: dotnet test AiTicketHub.sln
   Write the complete plan to ${CTX}/implementation-plan.md."
echo "  → ${CTX}/implementation-plan.md"
echo ""

# ─── Step 4: Bug Fixer (agent) ───────────────────────────────────────────────
echo "[4/6] Bug Fixer — applying changes and running tests..."
claude -p \
  --model claude-sonnet-4-5 \
  --agent "${REPO_ROOT}/agents/bug-fixer.agent.md" \
  --permission-mode bypassPermissions \
  --allowedTools "Read,Write,Edit,Bash" \
  "Apply every change in ${CTX}/implementation-plan.md to the source files in ${REPO_ROOT}.
   Run dotnet build AiTicketHub.sln and dotnet test AiTicketHub.sln after each change.
   Stop on the first build or test failure and document it.
   Write ${CTX}/fix-summary.md."
echo "  → ${CTX}/fix-summary.md + modified source files"
echo ""

# ─── Step 5: Security Verifier (agent) ───────────────────────────────────────
echo "[5/6] Security Verifier — scanning changed code for vulnerabilities..."
claude -p \
  --model claude-opus-4-5 \
  --agent "${REPO_ROOT}/agents/security-verifier.agent.md" \
  --permission-mode bypassPermissions \
  --allowedTools "Read,Write" \
  "Read ${CTX}/fix-summary.md to identify every changed source file.
   Open and review each file for security vulnerabilities per your instructions.
   Write ${CTX}/security-report.md. Do not edit any source file."
echo "  → ${CTX}/security-report.md"
echo ""

# ─── Step 6: Unit Test Generator (agent) ─────────────────────────────────────
echo "[6/6] Unit Test Generator — generating and running unit tests..."
claude -p \
  --model claude-sonnet-4-5 \
  --agent "${REPO_ROOT}/agents/unit-test-generator.agent.md" \
  --permission-mode bypassPermissions \
  --allowedTools "Read,Write,Edit,Bash" \
  "Read ${CTX}/fix-summary.md to identify every changed method and class.
   Use the FIRST skill in ${REPO_ROOT}/skills/unit-tests-FIRST.md when generating tests.
   Place test files in ${REPO_ROOT}/tests/AiTicketHub.Tests/.
   Run dotnet build AiTicketHub.sln then dotnet test AiTicketHub.sln.
   Write ${CTX}/test-report.md."
echo "  → ${CTX}/test-report.md + test files in tests/AiTicketHub.Tests/"
echo ""

echo "================================================"
echo " Pipeline complete."
echo " All outputs are in: ${CTX}/"
echo "================================================"
