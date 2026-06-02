# API Contract: Card Security Controls

**Base path**: `/api/v1/cards/:cardId/security`
**Auth**: Bearer JWT required. User MUST own the card.

All mutating endpoints require a short-lived re-authentication token in the
`X-Auth-Confirmation` header. Obtain it from `POST /api/v1/auth/confirm` (TTL 60 s,
single-use).

---

## POST /api/v1/auth/confirm

Obtain a confirmation token required before applying security changes.

### Request body

```json
{
  "method": "PIN",
  "credential": "pbkdf2-hash-of-pin"
}
```

`method`: `PIN` or `BIOMETRIC`
`credential`: PBKDF2-hashed PIN or WebAuthn / biometric assertion token

### Response 200 OK

```json
{
  "confirmationToken": "opaque-single-use-token",
  "expiresAt": "2026-06-03T15:06:00Z"
}
```

TTL: 60 seconds; invalidated after first use on a security mutation.

### Response 401 Unauthorized

```json
{
  "type": "https://cardflow.example/problems/invalid-credential",
  "title": "Invalid Credential",
  "status": 401,
  "detail": "Authentication failed. Please try again."
}
```

---

## GET /api/v1/cards/:cardId/security

Retrieve current security settings.

### Response 200 OK

```json
{
  "cardId": "cuid",
  "isFrozen": false,
  "blockInternational": false,
  "blockOnlineOnly": false,
  "blockAtm": false,
  "dailySpendLimit": null,
  "monthlySpendLimit": null,
  "updatedAt": "2026-06-01T10:00:00Z"
}
```

---

## PATCH /api/v1/cards/:cardId/security

Update one or more security settings atomically.

**Required header**: `X-Auth-Confirmation: <confirmation-token>`

### Request body — partial update; include only fields to change

```json
{
  "isFrozen": true
}
```

Multiple settings may be changed in a single request:

```json
{
  "blockInternational": true,
  "dailySpendLimit": 500.00
}
```

### Responses

**200 OK** — Settings applied (confirmed by card-network API; ≤ 5 s)

```json
{
  "cardId": "cuid",
  "isFrozen": true,
  "blockInternational": true,
  "blockOnlineOnly": false,
  "blockAtm": false,
  "dailySpendLimit": 500.00,
  "monthlySpendLimit": null,
  "updatedAt": "2026-06-03T15:05:00Z"
}
```

**401 Unauthorized** — Missing or expired confirmation token

```json
{
  "type": "https://cardflow.example/problems/auth-confirmation-required",
  "title": "Re-Authentication Required",
  "status": 401,
  "detail": "Security changes require re-authentication. Call POST /auth/confirm first."
}
```

**409 Conflict** — Card status does not allow modification

```json
{
  "type": "https://cardflow.example/problems/card-not-modifiable",
  "title": "Card Not Modifiable",
  "status": 409,
  "detail": "Security settings cannot be changed on a card with status LOST_STOLEN.",
  "cardStatus": "LOST_STOLEN"
}
```

**504 Gateway Timeout** — Card-network did not confirm within 5 seconds

```json
{
  "type": "https://cardflow.example/problems/network-timeout",
  "title": "Network Timeout",
  "status": 504,
  "detail": "The security change could not be confirmed. Please try again."
}
```

---

## POST /api/v1/cards/:cardId/security/report-lost-stolen

Permanently block the card and initiate a replacement order.

**Required header**: `X-Auth-Confirmation: <confirmation-token>`

### Request body

```json
{
  "reportType": "LOST",
  "notes": "Left on the train."
}
```

**`reportType`**: `LOST` or `STOLEN`

### Response 200 OK

```json
{
  "cardId": "cuid",
  "status": "LOST_STOLEN",
  "replacementCard": {
    "cardId": "cuid-new",
    "status": "ISSUED_PENDING_ACTIVATION",
    "lastFour": "9876"
  },
  "estimatedDeliveryDate": "2026-06-09",
  "reportedAt": "2026-06-03T15:07:00Z"
}
```

**409 Conflict** — Card is already `LOST_STOLEN` or `CLOSED`.
