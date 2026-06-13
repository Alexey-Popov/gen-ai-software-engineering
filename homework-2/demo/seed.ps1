$BASE_URL = "http://localhost:3000"

$tickets = @(
    @{
        customer_id    = "cust-001"
        customer_email = "alice@example.com"
        customer_name  = "Alice Johnson"
        subject        = "Cannot log into my account"
        description    = "I have been trying to log in for the past hour but keep getting an invalid credentials error even though my password is correct."
        status         = "new"
        tags           = @("login", "authentication")
        metadata       = @{ source = "web_form"; browser = "Chrome 124"; device_type = "desktop" }
    },
    @{
        customer_id    = "cust-002"
        customer_email = "bob@example.com"
        customer_name  = "Bob Smith"
        subject        = "App crashes on startup after latest update"
        description    = "Since installing version 3.2.1 the application crashes immediately on launch. I have tried reinstalling but the problem persists."
        status         = "new"
        tags           = @("crash", "startup", "v3.2.1")
        metadata       = @{ source = "email"; device_type = "mobile" }
    },
    @{
        customer_id    = "cust-003"
        customer_email = "carol@example.com"
        customer_name  = "Carol White"
        subject        = "Unexpected charge on my invoice"
        description    = "I was charged $49.99 on my last invoice but my plan should only cost $29.99 per month. Please investigate and refund the difference."
        status         = "new"
        assigned_to    = "billing-team"
        metadata       = @{ source = "chat" }
    },
    @{
        customer_id    = "cust-004"
        customer_email = "dave@example.com"
        customer_name  = "Dave Brown"
        subject        = "Request for dark mode support"
        description    = "It would be great to have a dark mode option in the settings. Many users have requested this and it would reduce eye strain during night-time use."
        status         = "new"
        tags           = @("dark-mode", "ui", "accessibility")
    },
    @{
        customer_id    = "cust-005"
        customer_email = "eve@example.com"
        customer_name  = "Eve Davis"
        subject        = "Slow response times on the dashboard"
        description    = "The main dashboard takes over 15 seconds to load when I have more than 100 items. Performance was fine before the last deployment."
        status         = "new"
        assigned_to    = "backend-team"
        tags           = @("performance", "dashboard")
        metadata       = @{ source = "api"; browser = "Firefox 125"; device_type = "desktop" }
    }
)

Write-Host "Seeding test data into $BASE_URL ..."
Write-Host ""

$created = 0
$failed  = 0

foreach ($ticket in $tickets) {
    $body = $ticket | ConvertTo-Json -Depth 5

    try {
        $response = Invoke-RestMethod -Method Post `
            -Uri "$BASE_URL/tickets" `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop

        Write-Host "[OK] Created ticket $($response.id) - '$($response.subject)'"
        $created++
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "[FAIL] $($ticket.subject) - HTTP $statusCode : $_"
        $failed++
    }
}

Write-Host ""
Write-Host "Done. Created: $created  Failed: $failed"
