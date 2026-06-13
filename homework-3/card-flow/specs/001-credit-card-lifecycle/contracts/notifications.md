# API Contract: Notifications

**Base path**: `/api/v1/notifications`
**Auth**: Bearer JWT required.

---

## GET /api/v1/notifications

Retrieve the user's in-app notification history (last 90 days).

### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| isRead | boolean | — | Filter by read status |
| type | string | — | Filter by notification type |
| cardId | string | — | Filter to a specific card |
| limit | integer | 25 | Max 100 |
| cursor | string | — | Pagination cursor |

### Response 200 OK

```json
{
  "notifications": [
    {
      "notificationId": "cuid",
      "type": "TRANSACTION_ALERT",
      "channel": "PUSH",
      "title": "Transaction Alert",
      "body": "A $42.50 charge at Blue Bottle Coffee was posted to your card ending 4321.",
      "cardId": "cuid",
      "isRead": false,
      "deliveryStatus": "DELIVERED",
      "metadata": {
        "transactionId": "cuid",
        "amount": 42.50,
        "merchantName": "Blue Bottle Coffee"
      },
      "createdAt": "2026-06-03T15:01:55Z"
    }
  ],
  "unreadCount": 3,
  "pagination": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

## PATCH /api/v1/notifications/:notificationId/read

Mark a single notification as read.

### Response 200 OK

```json
{
  "notificationId": "cuid",
  "isRead": true
}
```

---

## POST /api/v1/notifications/mark-all-read

Mark all unread in-app notifications as read for the authenticated user.

### Response 200 OK

```json
{
  "markedReadCount": 7
}
```

---

## GET /api/v1/notifications/preferences

Retrieve the user's notification preference settings (account-wide and per-card).

### Response 200 OK

```json
{
  "preferences": [
    {
      "preferenceId": "cuid",
      "cardId": null,
      "transactionAlertEnabled": true,
      "transactionAlertThreshold": 0.00,
      "paymentReminderEnabled": true,
      "paymentReminderDaysBefore": 3,
      "balanceThresholdEnabled": false,
      "balanceThreshold": null,
      "fraudAlertEnabled": true,
      "pushEnabled": true,
      "emailEnabled": true
    }
  ]
}
```

---

## PUT /api/v1/notifications/preferences

Create or update notification preferences (upsert). `cardId: null` sets account-wide
defaults; providing a `cardId` creates a card-specific override.

### Request body

```json
{
  "cardId": null,
  "transactionAlertEnabled": true,
  "transactionAlertThreshold": 50.00,
  "paymentReminderEnabled": true,
  "paymentReminderDaysBefore": 3,
  "balanceThresholdEnabled": true,
  "balanceThreshold": 4500.00,
  "fraudAlertEnabled": true,
  "pushEnabled": true,
  "emailEnabled": false
}
```

### Response 200 OK

```json
{
  "preferenceId": "cuid",
  "updatedAt": "2026-06-03T15:08:00Z"
}
```

---

## WebSocket: Real-Time Notification Feed

**Endpoint**: `wss://api.cardflow.example/ws/notifications`
**Auth**: `Authorization: Bearer <accessToken>` during handshake.

### Server → Client: `notification:new`

Fired when a new notification is created for the user.

```json
{
  "event": "notification:new",
  "data": {
    "notificationId": "cuid",
    "type": "TRANSACTION_ALERT",
    "title": "Transaction Alert",
    "body": "A $42.50 charge at Blue Bottle Coffee was posted to your card ending 4321.",
    "cardId": "cuid",
    "metadata": {
      "transactionId": "cuid",
      "amount": 42.50,
      "merchantName": "Blue Bottle Coffee"
    },
    "actions": [
      {
        "label": "That wasn't me",
        "action": "DISPUTE_TRANSACTION",
        "transactionId": "cuid"
      }
    ],
    "createdAt": "2026-06-03T15:01:55Z"
  }
}
```

The client handles the `actions` array by surfacing actionable buttons. Tapping
"That wasn't me" calls `POST /api/v1/cards/:cardId/transactions/:transactionId/dispute`.
