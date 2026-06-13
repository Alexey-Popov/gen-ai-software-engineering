$BASE_URL = "http://localhost:3000"

function Show-Step([string]$title) {
    Write-Host ""
    Write-Host "--- $title ---"
}

# ── 1. Create a ticket ────────────────────────────────────────────────────────
Show-Step "POST /tickets — create a ticket"

$newTicket = @{
    customer_id    = "cust-demo"
    customer_email = "demo@example.com"
    customer_name  = "Demo User"
    subject        = "Sample ticket from demo script"
    description    = "This ticket was created by the sample-requests.ps1 demo script to show the create endpoint."
    status         = "new"
} | ConvertTo-Json -Depth 3

$created = Invoke-RestMethod -Method Post `
    -Uri "$BASE_URL/tickets" `
    -ContentType "application/json" `
    -Body $newTicket
$created | ConvertTo-Json -Depth 5
$ticketId = $created.id

# ── 2. List all tickets ───────────────────────────────────────────────────────
Show-Step "GET /tickets — list all tickets"
Invoke-RestMethod -Uri "$BASE_URL/tickets" | ConvertTo-Json -Depth 5

# ── 3. Filter by status ───────────────────────────────────────────────────────
Show-Step "GET /tickets?status=new — filter by status"
Invoke-RestMethod -Uri "$BASE_URL/tickets?status=new" | ConvertTo-Json -Depth 5

# ── 4. Get single ticket ──────────────────────────────────────────────────────
Show-Step "GET /tickets/:id — get ticket by ID"
Invoke-RestMethod -Uri "$BASE_URL/tickets/$ticketId" | ConvertTo-Json -Depth 5

# ── 5. Update ticket ──────────────────────────────────────────────────────────
Show-Step "PUT /tickets/:id — update ticket"
$update = @{ assigned_to = "support-team"; status = "in_progress" } | ConvertTo-Json
Invoke-RestMethod -Method Put `
    -Uri "$BASE_URL/tickets/$ticketId" `
    -ContentType "application/json" `
    -Body $update | ConvertTo-Json -Depth 5

# ── 6. Bulk import from sample-data.json ─────────────────────────────────────
Show-Step "POST /tickets/import — bulk import from sample-data.json"
$importBody = Get-Content "$PSScriptRoot\sample-data.json" -Raw
Invoke-RestMethod -Method Post `
    -Uri "$BASE_URL/tickets/import" `
    -ContentType "application/json" `
    -Body $importBody | ConvertTo-Json -Depth 5

# ── 7. Delete the demo ticket ─────────────────────────────────────────────────
Show-Step "DELETE /tickets/:id — delete demo ticket"
try {
    Invoke-RestMethod -Method Delete -Uri "$BASE_URL/tickets/$ticketId" -ErrorAction Stop
    Write-Host "Ticket $ticketId deleted (HTTP 204)"
} catch {
    Write-Host "Delete response: $($_.Exception.Response.StatusCode)"
}

Write-Host ""
Write-Host "Demo complete."
