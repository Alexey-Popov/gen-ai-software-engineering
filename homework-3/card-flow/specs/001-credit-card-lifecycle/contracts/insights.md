# API Contract: Spending Insights

**Base path**: `/api/v1/cards/:cardId/insights`
**Auth**: Bearer JWT required. User MUST own the card.

All insights are served from pre-aggregated `SpendingInsightSnapshot` records refreshed by
the nightly BullMQ aggregation job. Intra-day data is not available in v1.

---

## GET /api/v1/cards/:cardId/insights/summary

Category spending breakdown for the selected period.

### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| period | string | `MONTHLY` | `WEEKLY`, `MONTHLY`, `QUARTERLY`, `ANNUAL` |
| periodStart | string | Current period start | ISO date `YYYY-MM-DD` |

### Response 200 OK

```json
{
  "cardId": "cuid",
  "period": "MONTHLY",
  "periodStart": "2026-06-01",
  "periodEnd": "2026-06-30",
  "totalSpend": 1234.56,
  "categories": [
    {
      "category": "DINING",
      "amount": 320.00,
      "transactionCount": 14,
      "percentageOfTotal": 25.9
    },
    {
      "category": "SHOPPING",
      "amount": 480.00,
      "transactionCount": 8,
      "percentageOfTotal": 38.9
    },
    {
      "category": "TRAVEL",
      "amount": 200.00,
      "transactionCount": 2,
      "percentageOfTotal": 16.2
    },
    {
      "category": "OTHER",
      "amount": 234.56,
      "transactionCount": 18,
      "percentageOfTotal": 19.0
    }
  ],
  "generatedAt": "2026-06-03T02:00:00Z"
}
```

---

## GET /api/v1/cards/:cardId/insights/trend

Month-over-month trend for a specific spending category.

### Query parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| category | string | Yes | e.g. `DINING` |
| months | integer | No (default 6) | Historical months to include; max 12 |

### Response 200 OK

```json
{
  "cardId": "cuid",
  "category": "DINING",
  "trend": [
    {
      "periodStart": "2026-01-01",
      "periodEnd": "2026-01-31",
      "amount": 289.00,
      "transactionCount": 11
    },
    {
      "periodStart": "2026-02-01",
      "periodEnd": "2026-02-28",
      "amount": 310.00,
      "transactionCount": 13
    },
    {
      "periodStart": "2026-06-01",
      "periodEnd": "2026-06-30",
      "amount": 320.00,
      "transactionCount": 14
    }
  ],
  "averageMonthlySpend": 305.00,
  "percentageChangeVsPriorMonth": 3.2
}
```

---

## GET /api/v1/cards/:cardId/insights/budgets

List all spending budgets for the card with current period utilisation.

### Response 200 OK

```json
{
  "budgets": [
    {
      "budgetId": "cuid",
      "category": "DINING",
      "budgetAmount": 400.00,
      "periodType": "MONTHLY",
      "spentAmount": 320.00,
      "utilisation": 80.0,
      "alertThresholdPercent": 80,
      "alertTriggered": true,
      "remainingAmount": 80.00
    }
  ]
}
```

---

## POST /api/v1/cards/:cardId/insights/budgets

Create a new spending budget.

### Request body

```json
{
  "category": "DINING",
  "budgetAmount": 400.00,
  "periodType": "MONTHLY",
  "alertThresholdPercent": 80
}
```

### Response 201 Created

```json
{
  "budgetId": "cuid",
  "category": "DINING",
  "budgetAmount": 400.00,
  "periodType": "MONTHLY",
  "alertThresholdPercent": 80,
  "isActive": true
}
```

### Response 409 Conflict — Budget already exists for this combination

```json
{
  "type": "https://cardflow.example/problems/budget-exists",
  "title": "Budget Already Exists",
  "status": 409,
  "detail": "A MONTHLY budget for DINING on this card already exists.",
  "existingBudgetId": "cuid"
}
```

---

## PUT /api/v1/cards/:cardId/insights/budgets/:budgetId

Update an existing budget (partial update).

### Request body

```json
{
  "budgetAmount": 450.00,
  "alertThresholdPercent": 75
}
```

### Response 200 OK

```json
{
  "budgetId": "cuid",
  "budgetAmount": 450.00,
  "alertThresholdPercent": 75,
  "updatedAt": "2026-06-03T16:00:00Z"
}
```

---

## DELETE /api/v1/cards/:cardId/insights/budgets/:budgetId

Delete a budget.

### Response 204 No Content
