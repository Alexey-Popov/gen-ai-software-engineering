# Banking Transactions API - sample requests (PowerShell)
# No extra tools required - uses built-in Invoke-RestMethod

$BASE_URL  = "http://localhost:3000"
$DATA_FILE = Join-Path $PSScriptRoot "sample-data.json"

# -- helpers ------------------------------------------------------------------

function Header($title) {
    Write-Host ""
    Write-Host "---  $title  ---" -ForegroundColor Cyan
}

function Invoke-GET($path) {
    try {
        $result = Invoke-RestMethod -Uri "$BASE_URL$path" -Method GET
        Write-Host "  HTTP 200" -ForegroundColor Green
        $result | ConvertTo-Json -Depth 5
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "  HTTP $status" -ForegroundColor Yellow
        $_.ErrorDetails.Message
    }
}

function Invoke-POST($body) {
    try {
        $result = Invoke-RestMethod -Uri "$BASE_URL/transactions" -Method POST `
            -ContentType "application/json" -Body $body
        Write-Host "  HTTP 201" -ForegroundColor Green
        $result | ConvertTo-Json -Depth 5
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "  HTTP $status" -ForegroundColor Yellow
        $_.ErrorDetails.Message
    }
}

# -- preflight ----------------------------------------------------------------

try {
    Invoke-RestMethod -Uri "$BASE_URL/transactions" -TimeoutSec 2 | Out-Null
} catch {
    Write-Host "ERROR: Server is not running. Start it with: npm run dev" -ForegroundColor Red
    exit 1
}

# =============================================================================
# 1. SEED - create all transactions from sample-data.json
# =============================================================================

Header "1. Seeding transactions from sample-data.json"

$transactions = Get-Content $DATA_FILE -Raw | ConvertFrom-Json

foreach ($t in $transactions) {
    Write-Host ""
    Write-Host "  POST /transactions - $($t.type)  $($t.fromAccount) -> $($t.toAccount)  $($t.amount) $($t.currency)"
    Invoke-POST ($t | ConvertTo-Json)
}

# =============================================================================
# 2. LIST - get all transactions
# =============================================================================

Header "2. List all transactions"
Invoke-GET "/transactions"

# =============================================================================
# 3. SINGLE - get one transaction by ID
# =============================================================================

Header "3. Get single transaction by ID"
$firstId = (Invoke-RestMethod -Uri "$BASE_URL/transactions")[0].id
Write-Host "  Using ID: $firstId"
Invoke-GET "/transactions/$firstId"

# =============================================================================
# 4. FILTERS
# =============================================================================

Header "4a. Filter by accountId=ACC-AA111"
Invoke-GET "/transactions?accountId=ACC-AA111"

Header "4b. Filter by type=transfer"
Invoke-GET "/transactions?type=transfer"

Header "4c. Filter by date range (today)"
$today = (Get-Date).ToString("yyyy-MM-dd")
Invoke-GET "/transactions?from=$today&to=$today"

Header "4d. Combined filter - ACC-AA111 + type=transfer"
Invoke-GET "/transactions?accountId=ACC-AA111&type=transfer"

# =============================================================================
# 5. BALANCE
# =============================================================================

Header "5. Account balance - ACC-AA111"
Invoke-GET "/accounts/ACC-AA111/balance"

# =============================================================================
# 6. SUMMARY
# =============================================================================

Header "6. Account summary - ACC-AA111"
Invoke-GET "/accounts/ACC-AA111/summary"

Header "6b. Account summary - ACC-CC333"
Invoke-GET "/accounts/ACC-CC333/summary"

# =============================================================================
# 7. ERROR CASES
# =============================================================================

Header "7a. Validation error - bad account format, negative amount, unknown currency"
Invoke-POST '{
  "fromAccount": "ACC123",
  "toAccount":   "ACC-BB222",
  "amount":      -50,
  "currency":    "XX",
  "type":        "transfer"
}'

Header "7b. Validation error - amount has more than 2 decimal places"
Invoke-POST '{
  "fromAccount": "ACC-AA111",
  "toAccount":   "ACC-BB222",
  "amount":      9.999,
  "currency":    "USD",
  "type":        "transfer"
}'

Header "7c. 404 - transaction not found"
Invoke-GET "/transactions/00000000-0000-0000-0000-000000000000"

Header "7d. 404 - account not found"
Invoke-GET "/accounts/ACC-ZZ999/summary"

Header "7e. Invalid filter parameters"
Invoke-GET "/transactions?accountId=BADFORMAT&type=invalid"

Write-Host ""
Write-Host "Done." -ForegroundColor Green
