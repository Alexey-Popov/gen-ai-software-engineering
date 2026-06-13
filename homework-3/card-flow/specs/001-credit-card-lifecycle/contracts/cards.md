# API Contract: Credit Cards

**Base path**: `/api/v1/cards`
**Auth**: Bearer JWT required. User MUST own the card.
**Headers on all responses**: `Cache-Control: no-store` (financial data)

---

## GET /api/v1/cards

List all credit cards for the authenticated user.

### Response 200 OK

```json
{
  "cards": [
    {
      "cardId": "cuid",
      "lastFour": "4321",
      "cardholderName": "JANE SMITH",
      "expiryMonth": 12,
      "expiryYear": 2029,
      "productType": "Cashback Platinum",
      "networkType": "VISA",
      "cardType": "PHYSICAL",
      "status": "ACTIVE",
      "creditLimit": 5000.00,
      "currentBalance": 1234.56,
      "availableCredit": 3765.44,
      "statementBalance": 980.00,
      "statementClosingDate": "2026-06-15",
      "minimumPaymentDue": 25.00,
      "paymentDueDate": "2026-07-10",
      "apr": 0.1999
    }
  ]
}
```

---

## GET /api/v1/cards/:cardId

Full account overview for a single card, including security settings.

### Response 200 OK

```json
{
  "cardId": "cuid",
  "lastFour": "4321",
  "cardholderName": "JANE SMITH",
  "expiryMonth": 12,
  "expiryYear": 2029,
  "productType": "Cashback Platinum",
  "networkType": "VISA",
  "cardType": "PHYSICAL",
  "status": "ACTIVE",
  "creditLimit": 5000.00,
  "currentBalance": 1234.56,
  "availableCredit": 3765.44,
  "statementBalance": 980.00,
  "statementClosingDate": "2026-06-15",
  "minimumPaymentDue": 25.00,
  "paymentDueDate": "2026-07-10",
  "apr": 0.1999,
  "issuedAt": "2026-05-20T00:00:00Z",
  "activatedAt": "2026-05-21T14:30:00Z",
  "securityControl": {
    "isFrozen": false,
    "blockInternational": false,
    "blockOnlineOnly": false,
    "blockAtm": false,
    "dailySpendLimit": null,
    "monthlySpendLimit": null
  }
}
```

**404 Not Found** — Card not found or not owned by requester.

---

## POST /api/v1/cards/:cardId/activate

Activate a card in `ISSUED_PENDING_ACTIVATION` status.

### Request body

```json
{
  "lastFourDigits": "4321",
  "authMethod": "PIN",
  "authToken": "hashed-pin-or-biometric-assertion"
}
```

`authToken` is:
- For `PIN`: PBKDF2-derived hash of the entered PIN (never sent raw over the wire).
- For `BIOMETRIC`: Platform biometric assertion token from `expo-local-authentication` or
  the browser WebAuthn API.

### Responses

**200 OK** — Activation successful

```json
{
  "cardId": "cuid",
  "status": "ACTIVE",
  "activatedAt": "2026-06-03T15:00:00Z"
}
```

**400 Bad Request** — Incorrect last-four digits

```json
{
  "type": "https://cardflow.example/problems/activation-mismatch",
  "title": "Activation Mismatch",
  "status": 400,
  "detail": "Card details do not match our records.",
  "attemptsRemaining": 2
}
```

**423 Locked** — Activation locked after 3 failed attempts

```json
{
  "type": "https://cardflow.example/problems/activation-locked",
  "title": "Activation Locked",
  "status": 423,
  "detail": "Too many failed attempts. Please contact support to activate your card.",
  "supportPhoneNumber": "1-800-CARDFLOW"
}
```

**409 Conflict** — Card not in activatable state (already `ACTIVE`, `FROZEN`, etc.)

```json
{
  "type": "https://cardflow.example/problems/invalid-status",
  "title": "Invalid Card Status",
  "status": 409,
  "detail": "Card cuid is already ACTIVE."
}
```

---

## GET /api/v1/cards/:cardId/account-summary

Lightweight balance poll endpoint for clients that cannot maintain a WebSocket connection.

### Response 200 OK

```json
{
  "cardId": "cuid",
  "currentBalance": 1234.56,
  "availableCredit": 3765.44,
  "minimumPaymentDue": 25.00,
  "paymentDueDate": "2026-07-10",
  "lastUpdated": "2026-06-03T15:01:30Z"
}
```

**Headers**: `Cache-Control: no-store`

---

## WebSocket: Real-Time Account Events

**Endpoint**: `wss://api.cardflow.example/ws/cards/:cardId`

**Auth**: `Authorization: Bearer <accessToken>` header during WebSocket handshake.
If the token is missing or expired, the server closes the connection with code `4401`.

### Server → Client events

**`balance:updated`** — Fired on any transaction post or payment that changes the balance.

```json
{
  "event": "balance:updated",
  "cardId": "cuid",
  "currentBalance": 1277.06,
  "availableCredit": 3722.94,
  "updatedAt": "2026-06-03T15:02:00Z"
}
```

**`transaction:new`** — A new pending or settled transaction has arrived.

```json
{
  "event": "transaction:new",
  "data": {
    "transactionId": "cuid",
    "type": "PURCHASE",
    "status": "PENDING",
    "amount": 42.50,
    "currency": "USD",
    "merchantName": "Blue Bottle Coffee",
    "category": "DINING",
    "authorisedAt": "2026-06-03T15:01:55Z"
  }
}
```

**`transaction:updated`** — A pending transaction settled, reversed, or was disputed.

```json
{
  "event": "transaction:updated",
  "data": {
    "transactionId": "cuid",
    "status": "SETTLED",
    "settledAt": "2026-06-04T00:00:00Z"
  }
}
```

**`card:status_changed`** — Card status changed (e.g., frozen, activated).

```json
{
  "event": "card:status_changed",
  "cardId": "cuid",
  "status": "FROZEN",
  "changedAt": "2026-06-03T15:03:00Z"
}
```
