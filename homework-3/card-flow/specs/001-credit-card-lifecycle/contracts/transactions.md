# API Contract: Transactions

**Base path**: `/api/v1/cards/:cardId/transactions`
**Auth**: Bearer JWT required. User MUST own the card.
**Headers**: `Cache-Control: no-store`

---

## GET /api/v1/cards/:cardId/transactions

Paginated transaction list using cursor-based (keyset) pagination.

### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| cursor | string | — | Opaque pagination cursor from prior response |
| limit | integer | 25 | Items per page; max 100 |
| status | string | — | `PENDING`, `SETTLED`, `REVERSED`, `DISPUTED` |
| category | string | — | e.g. `DINING`, `TRAVEL`, `SHOPPING` |
| dateFrom | string | — | ISO date `YYYY-MM-DD`, inclusive |
| dateTo | string | — | ISO date `YYYY-MM-DD`, inclusive |

### Response 200 OK

```json
{
  "transactions": [
    {
      "transactionId": "cuid",
      "type": "PURCHASE",
      "status": "SETTLED",
      "amount": 42.50,
      "currency": "USD",
      "merchantName": "Blue Bottle Coffee",
      "category": "DINING",
      "isInternational": false,
      "authorisedAt": "2026-06-02T12:30:00Z",
      "settledAt": "2026-06-03T00:00:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "opaque-base64-cursor",
    "hasMore": true
  }
}
```

### Response 400 Bad Request — Invalid filter

```json
{
  "type": "https://cardflow.example/problems/invalid-filter",
  "title": "Invalid Filter",
  "status": 400,
  "detail": "dateFrom (2026-06-10) must be before or equal to dateTo (2026-06-03)."
}
```

---

## GET /api/v1/cards/:cardId/transactions/:transactionId

Full detail for a single transaction.

### Response 200 OK

```json
{
  "transactionId": "cuid",
  "type": "PURCHASE",
  "status": "SETTLED",
  "amount": 42.50,
  "currency": "USD",
  "merchantName": "Blue Bottle Coffee",
  "merchantCategoryCode": "5812",
  "category": "DINING",
  "description": "Blue Bottle Coffee — SF Mission",
  "isInternational": false,
  "authorizationCode": "ABC123",
  "location": {
    "latitude": 37.7592,
    "longitude": -122.4194
  },
  "authorisedAt": "2026-06-02T12:30:00Z",
  "settledAt": "2026-06-03T00:00:00Z"
}
```

**404 Not Found** — Transaction not found or does not belong to this card.

---

## POST /api/v1/cards/:cardId/transactions/:transactionId/dispute

Dispute a transaction. Side effects: card is frozen; fraud case opened; case reference
number returned.

### Request body

```json
{
  "reason": "NOT_RECOGNISED",
  "notes": "I did not make this purchase."
}
```

**Allowed reason values**: `NOT_RECOGNISED`, `INCORRECT_AMOUNT`, `DUPLICATE`,
`GOODS_NOT_RECEIVED`, `OTHER`

### Response 201 Created

```json
{
  "disputeId": "cuid",
  "transactionId": "cuid",
  "status": "SUBMITTED",
  "cardFrozen": true,
  "caseReferenceNumber": "DISP-20260603-00001",
  "createdAt": "2026-06-03T15:05:00Z"
}
```

### Response 409 Conflict — Transaction already disputed

```json
{
  "type": "https://cardflow.example/problems/already-disputed",
  "title": "Already Disputed",
  "status": 409,
  "detail": "Transaction cuid already has an open dispute DISP-20260603-00001."
}
```
