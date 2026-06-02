# run-pipeline.ps1 - single-command 4-agent bug pipeline for AiTicketHub (Windows PowerShell)
# Usage: .\run-pipeline.ps1
# Requires: claude CLI installed and authenticated

$ErrorActionPreference = "Stop"

# --- Setup ---
$RepoRoot = $PSScriptRoot
$BugId    = "001"
$Ctx      = Join-Path $RepoRoot "context\bugs\$BugId"
$Src      = Join-Path $RepoRoot "src\AiTicketHub"

Set-Location $RepoRoot
New-Item -ItemType Directory -Force -Path $Ctx | Out-Null

Write-Host "================================================"
Write-Host " AiTicketHub 4-Agent Bug Pipeline"
Write-Host " Repo:    $RepoRoot"
Write-Host " Context: $Ctx"
Write-Host "================================================"
Write-Host ""

# --- Step 1: Bug Researcher (inline) ---
Write-Host "[1/6] Bug Researcher - scanning source for bugs..."
$p = "Read every .cs source file under $Src. For each suspicious finding (logic errors, state-machine gaps, hardcoded values, missing input validation, security issues) record: Finding ID (BUG-001, BUG-002 etc), file path relative to the repo root, line number, quoted snippet exact from file, one-sentence description. Write all findings to $Ctx\codebase-research.md."
$p | claude -p --model claude-sonnet-4-6 --permission-mode bypassPermissions --allowedTools "Read,Write,Glob,LS"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 1 failed"; exit 1 }
Write-Host "  -> $Ctx\codebase-research.md"
Write-Host ""

# --- Step 2: Research Verifier (agent) ---
Write-Host "[2/6] Research Verifier - fact-checking every finding..."
$p = "Verify every claim in $Ctx\codebase-research.md against the actual source files. Use the skill in $RepoRoot\skills\research-quality-measurement.md to score quality. Write your results to $Ctx\verified-research.md."
$p | claude -p --model claude-opus-4-7 --agent "$RepoRoot\agents\research-verifier.agent.md" --permission-mode bypassPermissions --allowedTools "Read,Write"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 2 failed"; exit 1 }
Write-Host "  -> $Ctx\verified-research.md"
Write-Host ""

# --- Step 3: Bug Planner (inline) ---
Write-Host "[3/6] Bug Planner - producing implementation plan..."
$p = "Read $Ctx\verified-research.md. For every entry in the References section produce a numbered change entry with: Change ID matching the Finding ID, target file path relative to repo root, Before block (exact current code to replace), After block (corrected replacement code), test command (dotnet test AiTicketHub.sln). Write the complete plan to $Ctx\implementation-plan.md."
$p | claude -p --model claude-sonnet-4-6 --permission-mode bypassPermissions --allowedTools "Read,Write"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 3 failed"; exit 1 }
Write-Host "  -> $Ctx\implementation-plan.md"
Write-Host ""

# --- Step 4: Bug Fixer (agent) ---
Write-Host "[4/6] Bug Fixer - applying changes and running tests..."
$p = "Apply every change in $Ctx\implementation-plan.md to the source files in $RepoRoot. Run dotnet build AiTicketHub.sln and dotnet test AiTicketHub.sln after each change. Stop on the first build or test failure and document it. Write $Ctx\fix-summary.md."
$p | claude -p --model claude-sonnet-4-6 --agent "$RepoRoot\agents\bug-fixer.agent.md" --permission-mode bypassPermissions --allowedTools "Read,Write,Edit,Bash"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 4 failed"; exit 1 }
Write-Host "  -> $Ctx\fix-summary.md + modified source files"
Write-Host ""

# --- Step 5: Security Verifier (agent) ---
Write-Host "[5/6] Security Verifier - scanning changed code for vulnerabilities..."
$p = "Read $Ctx\fix-summary.md to identify every changed source file. Open and review each file for security vulnerabilities per your instructions. Write $Ctx\security-report.md. Do not edit any source file."
$p | claude -p --model claude-opus-4-7 --agent "$RepoRoot\agents\security-verifier.agent.md" --permission-mode bypassPermissions --allowedTools "Read,Write"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 5 failed"; exit 1 }
Write-Host "  -> $Ctx\security-report.md"
Write-Host ""

# --- Step 6: Unit Test Generator (agent) ---
Write-Host "[6/6] Unit Test Generator - generating and running unit tests..."
$p = "Read $Ctx\fix-summary.md to identify every changed method and class. Use the FIRST skill in $RepoRoot\skills\unit-tests-FIRST.md when generating tests. Place test files in $RepoRoot\tests\AiTicketHub.Tests\. Run dotnet build AiTicketHub.sln then dotnet test AiTicketHub.sln. Write $Ctx\test-report.md."
$p | claude -p --model claude-sonnet-4-6 --agent "$RepoRoot\agents\unit-test-generator.agent.md" --permission-mode bypassPermissions --allowedTools "Read,Write,Edit,Bash"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 6 failed"; exit 1 }
Write-Host "  -> $Ctx\test-report.md + test files in tests\AiTicketHub.Tests\"
Write-Host ""

Write-Host "================================================"
Write-Host " Pipeline complete."
Write-Host " All outputs are in: $Ctx"
Write-Host "================================================"
