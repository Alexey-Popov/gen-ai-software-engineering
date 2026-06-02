# API Contract: Payments

**Base path**: `/api/v1/cards/:cardId/payments`
**Auth**: Bearer JWT required. User MUST own the card.
**Headers**: `Cache-Control: no-store`

---

## POST /api/v1/cards/:cardId/payments

Initiate a one-time payment.

**Required header**: `Idempotency-Key: <UUID>` — prevents duplicate charges on retry.

### Request body

```json
{
  "linkedBankAccountId": "cuid",
  "amountType": "CUSTOM",
  "customAmount": 150.00,
  "scheduledDate": "2026-06-05",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `customAmount` is required when `amountType = CUSTOM`; ignored otherwise.
- `scheduledDate` defaults to today (UTC) if omitted.

### Responses

**201 Created**

```json
{
  "paymentId": "cuid",
  "status": "SCHEDULED",
  "amount": 150.00,
  "amountType": "CUSTOM",
  "linkedBankAccount": {
    "accountId": "cuid",
    "displayName": "Chase Checking ••3421"
  },
  "scheduledDate": "2026-06-05",
  "estimatedPostingDate": "2026-06-07"
}
```

**200 OK** — Idempotency replay (same `Idempotency-Key`, same response as original)

**409 Conflict** — Duplicate payment detected (same card + amount within 60 seconds)

```json
{
  "type": "https://cardflow.example/problems/duplicate-payment",
  "title": "Duplicate Payment",
  "status": 409,
  "detail": "An identical payment was submitted within the last 60 seconds.",
  "existingPaymentId": "cuid"
}
```

**422 Unprocessable Entity**

```json
{
  "type": "https://cardflow.example/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "fields": {
    "customAmount": "Custom amount (1500.00) exceeds the current balance (1234.56)."
  }
}
```

---

## GET /api/v1/cards/:cardId/payments

List payments for a card (most recent first).

### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| status | string | — | Filter by payment status |
| limit | integer | 25 | Max 100 |
| cursor | string | — | Pagination cursor |

### Response 200 OK

```json
{
  "payments": [
    {
      "paymentId": "cuid",
      "type": "ONE_TIME",
      "status": "PROCESSED",
      "amount": 150.00,
      "amountType": "CUSTOM",
      "scheduledDate": "2026-06-05",
      "processedAt": "2026-06-05T08:00:00Z",
      "failureReason": null
    }
  ],
  "pagination": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

## DELETE /api/v1/cards/:cardId/payments/:paymentId

Cancel a scheduled payment. Only permitted when `status = SCHEDULED`.

### Response 200 OK

```json
{
  "paymentId": "cuid",
  "status": "CANCELLED"
}
```

### Response 409 Conflict

```json
{
  "type": "https://cardflow.example/problems/payment-not-cancellable",
  "title": "Payment Not Cancellable",
  "status": 409,
  "detail": "Payment cuid is in PROCESSING status and cannot be cancelled."
}
```

---

## GET /api/v1/cards/:cardId/autopay

Retrieve the active autopay rule. Returns **404** if no rule exists.

### Response 200 OK

```json
{
  "autopayRuleId": "cuid",
  "amountType": "STATEMENT_BALANCE",
  "fixedAmount": null,
  "preferredPaymentDay": 10,
  "linkedBankAccount": {
    "accountId": "cuid",
    "displayName": "Chase Checking ••3421"
  },
  "isActive": true,
  "nextScheduledDate": "2026-07-10"
}
```

---

## PUT /api/v1/cards/:cardId/autopay

Create or update the autopay rule (upsert). Only one active rule per card.

### Request body

```json
{
  "linkedBankAccountId": "cuid",
  "amountType": "STATEMENT_BALANCE",
  "fixedAmount": null,
  "preferredPaymentDay": 10
}
```

### Response 200 OK

```json
{
  "autopayRuleId": "cuid",
  "isActive": true,
  "nextScheduledDate": "2026-07-10"
}
```

---

## DELETE /api/v1/cards/:cardId/autopay

Deactivate and remove the autopay rule. Payments already created by this rule are not
cancelled.

### Response 204 No Content
