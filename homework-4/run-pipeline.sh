#!/usr/bin/env bash
# run-pipeline.sh — Jedi Holocron Vault bug-fix pipeline
#
# Usage:
#   ./run-pipeline.sh                  run every bug under context/bugs/
#   ./run-pipeline.sh <bug-id>         run one specific bug
#   ./run-pipeline.sh --help           show this message
#
# Agents are invoked in order:
#   bug-researcher → research-verifier → bug-planner → bug-fixer
#   → security-verifier → unit-test-generator
#
# Each agent reads context/bugs/<bug-id>/<inputs> and writes its output file.
# If an agent's gate file indicates BLOCKED or FAILED the remaining stages for
# that bug are skipped; the script continues with the next bug and exits non-zero
# once all bugs have been processed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
REPO_ROOT="$(cd .. && pwd)"

# ── helpers ───────────────────────────────────────────────────────────────────
header() { echo; echo "══════════════════════════════════════════════════════"; echo "  $*"; echo "══════════════════════════════════════════════════════"; }
step()   { echo; echo "▶ $*"; }
ok()     { echo "  ✓ $*"; }
abort()  { echo "  ✗ BLOCKED: $*"; }

usage() {
    cat <<EOF
Usage: $(basename "$0") [--help] [<bug-id>]

  <bug-id>   Run pipeline for one bug (must have context/bugs/<bug-id>/bug-context.md).
             Omit to run every bug discovered under context/bugs/.

Examples:
  ./run-pipeline.sh
  ./run-pipeline.sh 001-security-path-traversal
EOF
}

# ── arg parsing ───────────────────────────────────────────────────────────────
if [[ ${1:-} == "--help" || ${1:-} == "-h" ]]; then
    usage; exit 0
fi
if [[ $# -gt 1 ]]; then
    echo "ERROR: too many arguments" >&2; usage >&2; exit 1
fi

# ── pre-flight ────────────────────────────────────────────────────────────────
header "Jedi Holocron Vault — Bug-Fix Pipeline"

uv sync --quiet
command -v claude >/dev/null \
    || { echo "ERROR: claude CLI not on PATH — install from https://claude.ai/code" >&2; exit 1; }

# ── agent order ───────────────────────────────────────────────────────────────
AGENT_ORDER=(
    bug-researcher
    research-verifier
    bug-planner
    bug-fixer
    security-verifier
    unit-test-generator
)
TOTAL_AGENTS=${#AGENT_ORDER[@]}

# ── bug scope ─────────────────────────────────────────────────────────────────
if [[ $# -eq 1 ]]; then
    if [[ ! -f "context/bugs/$1/bug-context.md" ]]; then
        echo "ERROR: unknown bug-id '$1' (no context/bugs/$1/bug-context.md)" >&2
        echo "Available bug-ids:" >&2
        for d in context/bugs/*/; do
            [[ -d "$d" ]] && echo "  $(basename "$d")" >&2
        done
        exit 1
    fi
    BUGS=("$1")
else
    BUGS=()
    for d in context/bugs/*/; do
        [[ -d "$d" ]] && BUGS+=("$(basename "$d")")
    done
    if [[ ${#BUGS[@]} -eq 0 ]]; then
        echo "ERROR: no bug directories found under context/bugs/" >&2
        exit 1
    fi
fi

# ── frontmatter helpers ───────────────────────────────────────────────────────
frontmatter_field() {
    local file="$1" field="$2"
    awk -v f="$field" '
        /^---/ { count++; next }
        count == 1 && $0 ~ ("^" f ":") {
            sub("^" f ":[[:space:]]*", "")
            print; exit
        }
        count >= 2 { exit }
    ' "$file"
}

strip_frontmatter() {
    awk 'BEGIN{n=0} /^---/{n++; next} n>=2' "$1"
}

# ── gate helpers ──────────────────────────────────────────────────────────────
# Returns 0 (blocked) when the gate file is absent, starts with "BLOCKED:", or
# contains "Overall Status: FAILED". Returns 1 (clear) otherwise.
is_blocked() {
    local file="$1"
    [[ -z "$file" ]]           && return 0
    [[ ! -f "$file" ]]         && return 0
    head -1 "$file" | grep -q "^BLOCKED:"              && return 0
    grep -q "^Overall Status.*FAILED" "$file"           && return 0
    return 1
}

gate_file() {
    local agent="$1" bug_id="$2"
    case "$agent" in
        bug-researcher)      echo "context/bugs/${bug_id}/research/codebase-research.md" ;;
        research-verifier)   echo "context/bugs/${bug_id}/research/verified-research.md" ;;
        bug-planner)         echo "context/bugs/${bug_id}/implementation-plan.md" ;;
        bug-fixer)           echo "context/bugs/${bug_id}/fix-summary.md" ;;
        security-verifier)   echo "context/bugs/${bug_id}/security-report.md" ;;
        unit-test-generator) echo "context/bugs/${bug_id}/test-report.md" ;;
        *)                   echo "" ;;
    esac
}

# ── agent runner ──────────────────────────────────────────────────────────────
run_agent() {
    local agent="$1" bug_id="$2" step_num="$3"
    local agent_file="agents/${agent}.agent.md"
    local log_dir="context/bugs/${bug_id}/pipeline-log"
    local log_file="${log_dir}/${step_num}-${agent}.log"

    step "[${step_num}/${TOTAL_AGENTS}] ${agent}  (bug: ${bug_id})"

    if [[ ! -f "$agent_file" ]]; then
        echo "  ERROR: agent file not found: ${agent_file}" >&2
        return 1
    fi

    local MODEL TOOLS
    MODEL="$(frontmatter_field "$agent_file" "model")"
    TOOLS="$(frontmatter_field "$agent_file" "tools")"
    TOOLS="${TOOLS// /}"   # collapse "Read, Grep, Glob" → "Read,Grep,Glob"

    if [[ -z "$MODEL" || -z "$TOOLS" ]]; then
        echo "  ERROR: could not parse model/tools from ${agent_file}" >&2
        return 1
    fi

    mkdir -p "$log_dir"

    local task_prompt="You are the pipeline stage defined in your system prompt. The bug-id for this run is \`${bug_id}\`. Every \`<bug-id>\` placeholder in your instructions refers to it. Read your input file(s), do your single responsibility, and write your output file. Begin."

    # Capture claude's exit code without letting pipefail abort the script.
    # set +e is restored immediately after PIPESTATUS is captured.
    local rc
    set +e
    claude -p "$task_prompt" \
        --model "$MODEL" \
        --append-system-prompt "$(strip_frontmatter "$agent_file")" \
        --allowedTools "$TOOLS" \
        --permission-mode bypassPermissions \
        --output-format text \
        --add-dir "$REPO_ROOT" \
        2>&1 | tee "$log_file"
    rc=${PIPESTATUS[0]}
    set -e

    if [[ $rc -ne 0 ]]; then
        echo "  ERROR: claude exited with code $rc — see ${log_file}" >&2
        return "$rc"
    fi
}

# ── main loop ─────────────────────────────────────────────────────────────────
BUG_RESULTS=()
OVERALL_EXIT=0

for bug_id in "${BUGS[@]}"; do
    header "Bug: ${bug_id}"
    PIPELINE_BLOCKED=false
    BLOCKED_AT=""

    for i in "${!AGENT_ORDER[@]}"; do
        agent="${AGENT_ORDER[$i]}"
        step_num=$((i + 1))

        if ! run_agent "$agent" "$bug_id" "$step_num"; then
            abort "${agent} CLI call failed — stopping pipeline for ${bug_id}"
            PIPELINE_BLOCKED=true
            BLOCKED_AT="$agent"
            break
        fi

        gate="$(gate_file "$agent" "$bug_id")"
        if is_blocked "$gate"; then
            abort "${agent} output indicates failure — stopping pipeline for ${bug_id}"
            PIPELINE_BLOCKED=true
            BLOCKED_AT="$agent"
            break
        fi
        ok "${agent} → ${gate}"
    done

    if [[ "$PIPELINE_BLOCKED" == "false" ]]; then
        BUG_RESULTS+=("${bug_id}: PASSED")
    else
        BUG_RESULTS+=("${bug_id}: BLOCKED at ${BLOCKED_AT}")
        OVERALL_EXIT=1
    fi
done

# ── summary ───────────────────────────────────────────────────────────────────
header "Pipeline Summary"

echo "  Results:"
for result in "${BUG_RESULTS[@]}"; do
    echo "    ${result}"
done

echo
echo "  Artifacts written:"
for bug_id in "${BUGS[@]}"; do
    for agent in "${AGENT_ORDER[@]}"; do
        f="$(gate_file "$agent" "$bug_id")"
        [[ -n "$f" && -f "$f" ]] && echo "    $f"
    done
done
echo

exit "$OVERALL_EXIT"
