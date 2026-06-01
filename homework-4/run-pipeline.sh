#!/bin/bash
set -e

echo "============================================"
echo "    4-Agent Pipeline - Homework 4"
echo "============================================"
echo ""

cd "$(dirname "$0")"

BUG_DIRS=(context/bugs/*/)

if [ ${#BUG_DIRS[@]} -eq 0 ]; then
  echo "ERROR: No bug directories found in context/bugs/"
  exit 1
fi

echo "Found ${#BUG_DIRS[@]} bug(s) to process"
echo ""

for bug_dir in "${BUG_DIRS[@]}"; do
  bug_name=$(basename "$bug_dir")
  echo "============================================"
  echo "Processing: $bug_name"
  echo "============================================"
  echo ""

  # Phase 1: Research Verifier
  echo "[1/4] Research Verifier"
  echo "  Input:  $bug_dir/research/codebase-research.md"
  echo "  Output: $bug_dir/research/verified-research.md"
  echo "  Agent:  agents/research-verifier.agent.md"
  echo ""

  if [ -f "$bug_dir/research/codebase-research.md" ]; then
    claude --agent agents/research-verifier.agent.md \
      --prompt "Verify the research in $bug_dir/research/codebase-research.md and create $bug_dir/research/verified-research.md" \
      --allowedTools "Read,Write,Glob,Grep" \
      2>/dev/null || echo "  [WARN] Research verifier completed with warnings"
  else
    echo "  [SKIP] No codebase-research.md found"
  fi
  echo ""

  # Phase 2: Bug Fixer
  echo "[2/4] Bug Fixer"
  echo "  Input:  $bug_dir/implementation-plan.md"
  echo "  Output: $bug_dir/fix-summary.md"
  echo "  Agent:  agents/bug-fixer.agent.md"
  echo ""

  if [ -f "$bug_dir/implementation-plan.md" ]; then
    claude --agent agents/bug-fixer.agent.md \
      --prompt "Apply fixes from $bug_dir/implementation-plan.md and create $bug_dir/fix-summary.md" \
      --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
      2>/dev/null || echo "  [WARN] Bug fixer completed with warnings"
  else
    echo "  [SKIP] No implementation-plan.md found"
  fi
  echo ""

  # Phase 3: Security Verifier
  echo "[3/4] Security Verifier"
  echo "  Input:  $bug_dir/fix-summary.md + changed files"
  echo "  Output: $bug_dir/security-report.md"
  echo "  Agent:  agents/security-verifier.agent.md"
  echo ""

  claude --agent agents/security-verifier.agent.md \
    --prompt "Review security of changed files from $bug_dir/fix-summary.md and create $bug_dir/security-report.md" \
    --allowedTools "Read,Write,Glob,Grep" \
    2>/dev/null || echo "  [WARN] Security verifier completed with warnings"
  echo ""

  # Phase 4: Unit Test Generator
  echo "[4/4] Unit Test Generator"
  echo "  Input:  $bug_dir/fix-summary.md + changed files"
  echo "  Output: tests/ + $bug_dir/test-report.md"
  echo "  Agent:  agents/unit-test-generator.agent.md"
  echo ""

  claude --agent agents/unit-test-generator.agent.md \
    --prompt "Generate tests for changes in $bug_dir/fix-summary.md following FIRST principles. Create tests in tests/ and $bug_dir/test-report.md" \
    --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    2>/dev/null || echo "  [WARN] Unit test generator completed with warnings"
  echo ""

  echo "Completed: $bug_name"
  echo ""
done

echo "============================================"
echo "Pipeline Complete"
echo "============================================"
echo ""
echo "Running final tests..."
npm test || echo "[WARN] Some tests may have failed"

echo ""
echo "Generated files:"
find context/bugs -name "*.md" -newer package.json 2>/dev/null | sort
echo ""
echo "Done!"
