# Data Model: CardFlow — Credit Card Lifecycle Management

**Feature**: CardFlow
**Date**: 2026-06-03
**Derived from**: spec.md + research.md (PCI-DSS tokenisation, GDPR pseudonymisation)
**ORM**: Prisma 6 — schema file at `backend/prisma/schema.prisma`

---

## Entity Relationship Diagram

```
User ──────────────────────── CreditCardApplication
  │  1:N                              │ 1:1 (on approval)
  │                                   ▼
  ├──── 1:N ──────────────── CreditCard ──── 1:1 ──── SecurityControl
  │                               │
  │                               ├── 1:N ── Transaction
  │                               ├── 1:N ── Payment
  │                               ├── 0:1 ── AutopayRule
  │                               └── 1:N ── SpendingBudget
  │
  ├──── 1:N ──────────────── LinkedBankAccount
  ├──── 1:N ──────────────── Notification
  ├──── 1:1 ──────────────── NotificationPreference
  └──── 1:N ──────────────── RefreshToken

SpendingInsightSnapshot (pre-aggregated, linked to CreditCard)
AuditLog (append-only, linked to any entity)
```

---

## 1. User

Represents an authenticated cardholder or prospective applicant.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | `@default(cuid())` |
| email | String | UNIQUE NOT NULL | RFC 5321 validated |
| phoneNumber | String? | UNIQUE | E.164 format; optional |
| firstName | String | NOT NULL | |
| lastName | String | NOT NULL | |
| dateOfBirth | DateTime | NOT NULL | `@db.Date`; must yield age ≥ 18 |
| addressLine1 | String | NOT NULL | |
| addressLine2 | String? | | |
| city | String | NOT NULL | |
| state | String | NOT NULL | |
| postalCode | String | NOT NULL | |
| country | String | NOT NULL DEFAULT "US" | ISO 3166-1 alpha-2 |
| kycStatus | KycStatus | NOT NULL DEFAULT PENDING | Enum |
| passwordHash | String | NOT NULL | bcrypt, cost factor ≥ 12 |
| totpSecret | String? | | Encrypted at rest (AES-256-GCM) |
| mfaEnabled | Boolean | NOT NULL DEFAULT false | |
| deletedAt | DateTime? | | Soft-delete; hard-delete PII after 30 days |
| createdAt | DateTime | NOT NULL DEFAULT now() | |
| updatedAt | DateTime | NOT NULL @updatedAt | |

**Validation rules**:
- `email` MUST pass RFC 5321 format; uniqueness enforced at DB level.
- Age derived from `dateOfBirth` MUST be ≥ 18 at the time of registration.
- `passwordHash`: bcrypt with cost factor ≥ 12; checked by service layer.
- PII fields (firstName, lastName, dateOfBirth, address fields) are pseudonymised
  (replaced with `[REDACTED-<hash>]`) on GDPR erasure after the 30-day grace period.
  Financial records referencing this user are not deleted — they reference the pseudonymised user.

**Enums**: `KycStatus { PENDING VERIFIED FAILED }`

---

## 2. RefreshToken

Stores one hashed refresh token per user session (supports multiple active sessions).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| userId | String | FK → User.id NOT NULL | |
| tokenHash | String | NOT NULL | bcrypt hash of the opaque token |
| expiresAt | DateTime | NOT NULL | 90 days from issuance |
| revokedAt | DateTime? | | Set on logout or rotation |
| deviceHint | String? | | e.g. "iPhone 16 / Safari" for display |
| createdAt | DateTime | NOT NULL DEFAULT now() | |

**Rotation protocol**: On `/auth/refresh`, the presented token is validated against
`tokenHash`. A new token is issued, the old record's `revokedAt` is set. If a revoked
token is ever presented, ALL `RefreshToken` records for the user are revoked immediately
(theft detection).

---

## 3. CreditCardApplication

Tracks the full lifecycle of a credit card application.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| userId | String? | FK → User.id | Null for guest drafts |
| guestToken | String? | UNIQUE | For unauthenticated drafts |
| status | ApplicationStatus | NOT NULL DEFAULT DRAFT | See state machine |
| productType | String | NOT NULL | e.g. "Cashback Platinum" |
| annualIncome | Decimal | NOT NULL | `@db.Decimal(14,2)` |
| employmentStatus | EmploymentStatus | NOT NULL | Enum |
| ssnLastFour | String? | | Encrypted at rest; Char(4) after decryption |
| requestedCreditLimit | Decimal? | | `@db.Decimal(12,2)` |
| approvedCreditLimit | Decimal? | | Set on APPROVED transition |
| approvedApr | Decimal? | | `@db.Decimal(5,4)` e.g. 0.1999 = 19.99% |
| declineReasonCode | String? | | Machine-readable code |
| declineReasonSummary | String? | | Human-readable; shown in UI |
| adverseActionNoticeUrl | String? | | Signed S3 URL (90-day TTL) |
| adverseActionNoticeSentAt | DateTime? | | |
| referenceNumber | String | UNIQUE NOT NULL | `CF-YYYYMMDD-NNNNN` format |
| submittedAt | DateTime? | | Set on SUBMITTED transition |
| decidedAt | DateTime? | | Set on APPROVED or DECLINED |
| expiresAt | DateTime? | | Draft expiry: 30 days from last update |
| createdAt | DateTime | NOT NULL DEFAULT now() | |
| updatedAt | DateTime | NOT NULL @updatedAt | |

**Status state machine**:

```
DRAFT ──► SUBMITTED ──► UNDER_REVIEW ──► APPROVED
                │                    └──► DECLINED
                └──────────────────────► WITHDRAWN
```

- `DRAFT → SUBMITTED`: User completes and submits form; `referenceNumber` generated.
- `SUBMITTED → UNDER_REVIEW`: Underwriting service acknowledges.
- `UNDER_REVIEW → APPROVED`: `approvedCreditLimit` + `approvedApr` set; CreditCard record created.
- `UNDER_REVIEW → DECLINED`: `declineReasonCode`, `declineReasonSummary`, `adverseActionNoticeUrl` MUST be set.
- `SUBMITTED | UNDER_REVIEW → WITHDRAWN`: User cancels voluntarily.
- `APPROVED` and `DECLINED` are terminal — no further transitions.

**Enums**:
- `ApplicationStatus { DRAFT SUBMITTED UNDER_REVIEW APPROVED DECLINED WITHDRAWN }`
- `EmploymentStatus { EMPLOYED SELF_EMPLOYED UNEMPLOYED RETIRED STUDENT }`

**Validation rules**:
- `annualIncome` ≥ 0.
- `referenceNumber` auto-generated at SUBMITTED transition; format `CF-YYYYMMDD-NNNNN`.
- `ssnLastFour` stored AES-256-GCM encrypted; never logged or returned in API responses.

---

## 4. CreditCard

Represents a physical or virtual credit card account.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| userId | String | FK → User.id NOT NULL | |
| applicationId | String? | FK → CreditCardApplication.id | |
| panToken | String | UNIQUE NOT NULL | Basis Theory vault token |
| lastFour | String | NOT NULL | Char(4) |
| cardholderName | String | NOT NULL | As embossed on card |
| expiryMonth | Int | NOT NULL | 1–12 |
| expiryYear | Int | NOT NULL | 4-digit year |
| productType | String | NOT NULL | |
| networkType | NetworkType | NOT NULL | Enum |
| cardType | CardType | NOT NULL | Enum |
| status | CardStatus | NOT NULL | See state machine |
| creditLimit | Decimal | NOT NULL | `@db.Decimal(12,2)` |
| currentBalance | Decimal | NOT NULL DEFAULT 0 | Updated on transaction post / payment |
| statementBalance | Decimal? | | Balance at last statement close |
| statementClosingDate | DateTime? | | `@db.Date` |
| minimumPaymentDue | Decimal? | | `@db.Decimal(12,2)` |
| paymentDueDate | DateTime? | | `@db.Date` |
| apr | Decimal | NOT NULL | `@db.Decimal(5,4)` |
| activationAttempts | Int | NOT NULL DEFAULT 0 | Incremented on failed activation |
| activationLocked | Boolean | NOT NULL DEFAULT false | Set after 3 failed attempts |
| issuedAt | DateTime? | | |
| activatedAt | DateTime? | | Set on ACTIVE transition |
| closedAt | DateTime? | | |
| createdAt | DateTime | NOT NULL DEFAULT now() | |
| updatedAt | DateTime | NOT NULL @updatedAt | |

**Computed**: `availableCredit = creditLimit - currentBalance`

**Status state machine**:

```
ISSUED_PENDING_ACTIVATION ──► ACTIVE ◄──► FROZEN
          │                      │
          └──────────────────────┴──► LOST_STOLEN (permanent)
                                  └──► CLOSED
```

- `ISSUED_PENDING_ACTIVATION → ACTIVE`: Correct last-four + auth confirmation. `activatedAt` set.
- `ACTIVE ↔ FROZEN`: Toggle via SecurityControl; reversible; round-trip ≤ 5 s.
- `ACTIVE | FROZEN → LOST_STOLEN`: Irreversible; replacement card ordered automatically.
- Any → `CLOSED`: Administrative or cardholder-initiated closure.

**Enums**:
- `CardStatus { ISSUED_PENDING_ACTIVATION ACTIVE FROZEN LOST_STOLEN CLOSED }`
- `NetworkType { VISA MASTERCARD AMEX DISCOVER }`
- `CardType { PHYSICAL VIRTUAL }`

**Validation rules**:
- `activationAttempts` incremented on each failure; `activationLocked = true` when it reaches 3.
- `currentBalance` MUST NOT be updated directly via API — only via the Transaction service.
- `availableCredit` MUST NOT go below 0; over-limit blocked at authorisation layer.

---

## 5. Transaction

An individual debit or credit event posted to a card.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| cardId | String | FK → CreditCard.id NOT NULL | |
| externalId | String? | UNIQUE | Card-network transaction ID |
| type | TransactionType | NOT NULL | Enum |
| status | TransactionStatus | NOT NULL DEFAULT PENDING | Enum |
| amount | Decimal | NOT NULL | `@db.Decimal(12,2)`; positive = debit |
| currency | String | NOT NULL DEFAULT "USD" | ISO 4217 |
| merchantName | String? | | |
| merchantCategoryCode | String? | | ISO 18245 MCC (4 digits) |
| category | String? | | Derived from MCC mapping |
| description | String? | | |
| isInternational | Boolean | NOT NULL DEFAULT false | |
| authorizationCode | String? | | |
| latitude | Float? | | Merchant geolocation |
| longitude | Float? | | Merchant geolocation |
| authorisedAt | DateTime | NOT NULL | |
| settledAt | DateTime? | | Set on SETTLED |
| createdAt | DateTime | NOT NULL DEFAULT now() | |
| updatedAt | DateTime | NOT NULL @updatedAt | |

**Status state machine**:

```
PENDING ──► SETTLED
   └──► REVERSED
SETTLED ──► DISPUTED
```

**Enums**:
- `TransactionType { PURCHASE REFUND CASH_ADVANCE FEE INTEREST PAYMENT_REVERSAL }`
- `TransactionStatus { PENDING SETTLED REVERSED DISPUTED }`

**Validation rules**:
- `amount` MUST NOT be zero.
- `category` is derived automatically from `merchantCategoryCode` via a static MCC lookup
  table on ingest; stored for fast filtering.
- International transactions (`isInternational = true`) MUST be checked against the card's
  `SecurityControl.blockInternational` flag before authorisation is granted.

**Indexes**:
- `@@index([cardId, authorisedAt(sort: Desc)])` — transaction list pagination
- `@@index([cardId, status])` — pending/settled filter

---

## 6. Payment

An outbound payment from a linked bank account to the credit card.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| cardId | String | FK → CreditCard.id NOT NULL | |
| linkedBankAccountId | String | FK → LinkedBankAccount.id NOT NULL | |
| type | PaymentType | NOT NULL | Enum |
| status | PaymentStatus | NOT NULL DEFAULT SCHEDULED | Enum |
| amountType | PaymentAmountType | NOT NULL | Enum |
| amount | Decimal | NOT NULL | Resolved final amount |
| scheduledDate | DateTime | NOT NULL | `@db.Date` |
| processedAt | DateTime? | | |
| failureReason | String? | | |
| idempotencyKey | String | UNIQUE NOT NULL | Client-supplied UUID |
| autopayRuleId | String? | FK → AutopayRule.id | Present if generated by autopay |
| createdAt | DateTime | NOT NULL DEFAULT now() | |
| updatedAt | DateTime | NOT NULL @updatedAt | |

**Status state machine**:

```
SCHEDULED ──► PROCESSING ──► PROCESSED
                  └──────────► FAILED
                  └──────────► CANCELLED
```

**Enums**:
- `PaymentType { ONE_TIME AUTOPAY }`
- `PaymentStatus { SCHEDULED PROCESSING PROCESSED FAILED CANCELLED }`
- `PaymentAmountType { MINIMUM_PAYMENT STATEMENT_BALANCE CURRENT_BALANCE CUSTOM }`

**Validation rules**:
- `amount` for `MINIMUM_PAYMENT` MUST equal the current minimum payment due.
- Duplicate detection: a new payment MUST be rejected (HTTP 409) if another payment with
  the same `cardId` and `amount` exists in `SCHEDULED` or `PROCESSING` status within the
  last 60 seconds.
- `idempotencyKey` MUST be present; the server stores the response for 24 hours and
  returns it on replay (prevents double-charge on network retry).

**Indexes**:
- `@@index([cardId, scheduledDate])` — upcoming payment queries
- `@@unique([idempotencyKey])`

---

## 7. AutopayRule

Recurring payment configuration for a card (at most one active rule per card).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| cardId | String | FK → CreditCard.id UNIQUE NOT NULL | One rule per card |
| linkedBankAccountId | String | FK → LinkedBankAccount.id NOT NULL | |
| amountType | PaymentAmountType | NOT NULL | |
| fixedAmount | Decimal? | | Required when amountType = CUSTOM |
| preferredPaymentDay | Int | NOT NULL | 1–28 |
| isActive | Boolean | NOT NULL DEFAULT true | |
| nextScheduledDate | DateTime? | | `@db.Date`; computed |
| createdAt | DateTime | NOT NULL DEFAULT now() | |
| updatedAt | DateTime | NOT NULL @updatedAt | |

**Validation rules**:
- `@@unique([cardId])` enforces one rule per card.
- `fixedAmount` MUST be > 0 when `amountType = CUSTOM`.
- BullMQ cron job runs nightly at 00:00 UTC, evaluates active rules, creates `Payment`
  records for rules due within the next 3 days, and fires payment reminder notifications.

---

## 8. LinkedBankAccount

A bank account the user has enrolled for payments.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| userId | String | FK → User.id NOT NULL | |
| displayName | String | NOT NULL | e.g. "Chase Checking ••3421" |
| bankName | String | NOT NULL | |
| accountToken | String | UNIQUE NOT NULL | ACH/Plaid token; never raw account number |
| lastFour | String | NOT NULL | |
| accountType | BankAccountType | NOT NULL | Enum |
| isVerified | Boolean | NOT NULL DEFAULT false | |
| isDefault | Boolean | NOT NULL DEFAULT false | |
| createdAt | DateTime | NOT NULL DEFAULT now() | |
| updatedAt | DateTime | NOT NULL @updatedAt | |

**Enums**: `BankAccountType { CHECKING SAVINGS }`

---

## 9. SecurityControl

Per-card security settings. Exactly one record per card (created when card is issued).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| cardId | String | FK → CreditCard.id UNIQUE NOT NULL | |
| isFrozen | Boolean | NOT NULL DEFAULT false | |
| blockInternational | Boolean | NOT NULL DEFAULT false | |
| blockOnlineOnly | Boolean | NOT NULL DEFAULT false | |
| blockAtm | Boolean | NOT NULL DEFAULT false | |
| dailySpendLimit | Decimal? | | `@db.Decimal(12,2)`; NULL = no limit |
| monthlySpendLimit | Decimal? | | `@db.Decimal(12,2)`; NULL = no limit |
| updatedAt | DateTime | NOT NULL @updatedAt | |
| updatedByUserId | String | FK → User.id NOT NULL | Audit trail |

**Validation rules**:
- Every mutation requires a valid `confirmationToken` (from `POST /auth/confirm`; TTL 60 s;
  single-use) in the request context. Service layer rejects mutations without it.
- Changes are propagated to the card-network authorisation system synchronously;
  mutation returns only after network confirmation (timeout → HTTP 504).
- `dailySpendLimit` and `monthlySpendLimit` MUST be > 0 if non-null.

---

## 10. Notification

Records every alert sent or queued for a user across all channels.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| userId | String | FK → User.id NOT NULL | |
| cardId | String? | FK → CreditCard.id | Null for account-level alerts |
| type | NotificationType | NOT NULL | Enum |
| channel | NotificationChannel | NOT NULL | Enum |
| title | String | NOT NULL | |
| body | String | NOT NULL | |
| metadata | Json? | | Transaction ID, amount, dispute flags, etc. |
| isRead | Boolean | NOT NULL DEFAULT false | In-app only |
| deliveryStatus | DeliveryStatus | NOT NULL DEFAULT PENDING | Enum |
| deliveredAt | DateTime? | | |
| createdAt | DateTime | NOT NULL DEFAULT now() | |

**Enums**:
- `NotificationType { TRANSACTION_ALERT PAYMENT_REMINDER PAYMENT_CONFIRMED PAYMENT_FAILED FRAUD_ALERT APPLICATION_UPDATE SECURITY_CHANGE BUDGET_THRESHOLD }`
- `NotificationChannel { PUSH EMAIL IN_APP }`
- `DeliveryStatus { PENDING DELIVERED FAILED }`

**Validation rules**:
- `TRANSACTION_ALERT` records MUST be created within 60 seconds of the triggering
  transaction's `authorisedAt` timestamp.
- Records are purged after 90 days by a nightly BullMQ cleanup job.

**Indexes**:
- `@@index([userId, createdAt(sort: Desc)])` — notification history pagination

---

## 11. NotificationPreference

User-configurable alert settings; one record per user (optionally per card).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| userId | String | FK → User.id NOT NULL | |
| cardId | String? | FK → CreditCard.id | Null = applies to all cards |
| transactionAlertEnabled | Boolean | NOT NULL DEFAULT true | |
| transactionAlertThreshold | Decimal | NOT NULL DEFAULT 0 | 0 = every transaction |
| paymentReminderEnabled | Boolean | NOT NULL DEFAULT true | |
| paymentReminderDaysBefore | Int | NOT NULL DEFAULT 3 | |
| balanceThresholdEnabled | Boolean | NOT NULL DEFAULT false | |
| balanceThreshold | Decimal? | | |
| fraudAlertEnabled | Boolean | NOT NULL DEFAULT true | |
| pushEnabled | Boolean | NOT NULL DEFAULT true | |
| emailEnabled | Boolean | NOT NULL DEFAULT true | |
| updatedAt | DateTime | NOT NULL @updatedAt | |

**Unique constraint**: `@@unique([userId, cardId])`.

---

## 12. SpendingBudget

User-defined spending limit per category with alerting.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| userId | String | FK → User.id NOT NULL | |
| cardId | String? | FK → CreditCard.id | Null = all cards |
| category | String | NOT NULL | Must match Transaction.category values |
| budgetAmount | Decimal | NOT NULL | `@db.Decimal(12,2)` |
| periodType | PeriodType | NOT NULL | Enum |
| alertThresholdPercent | Int | NOT NULL DEFAULT 80 | 1–100 |
| isActive | Boolean | NOT NULL DEFAULT true | |
| createdAt | DateTime | NOT NULL DEFAULT now() | |
| updatedAt | DateTime | NOT NULL @updatedAt | |

**Unique constraint**: `@@unique([userId, cardId, category, periodType])`.

**Enums**: `PeriodType { WEEKLY MONTHLY QUARTERLY ANNUAL }`

---

## 13. SpendingInsightSnapshot

Pre-aggregated spending summary generated by the nightly BullMQ job.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| cardId | String | FK → CreditCard.id NOT NULL | |
| periodType | PeriodType | NOT NULL | |
| periodStart | DateTime | NOT NULL | `@db.Date` |
| periodEnd | DateTime | NOT NULL | `@db.Date` |
| category | String | NOT NULL | |
| totalAmount | Decimal | NOT NULL | `@db.Decimal(14,2)` |
| transactionCount | Int | NOT NULL | |
| generatedAt | DateTime | NOT NULL DEFAULT now() | |

**Unique constraint**: `@@unique([cardId, periodType, periodStart, category])`.

**Indexes**:
- `@@index([cardId, periodType, periodStart(sort: Desc)])` — insights dashboard queries

---

## 14. AuditLog

Append-only log of all writes to security-sensitive tables.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (UUID) | PK | |
| entityType | String | NOT NULL | e.g. "CreditCard", "Payment", "SecurityControl" |
| entityId | String | NOT NULL | |
| action | String | NOT NULL | e.g. "STATUS_CHANGED", "FROZEN", "PAYMENT_CREATED" |
| actorUserId | String? | | Null for system actions |
| before | Json? | | Snapshot of entity before change |
| after | Json? | | Snapshot of entity after change |
| ipAddress | String? | | |
| userAgent | String? | | |
| createdAt | DateTime | NOT NULL DEFAULT now() | |

The `AuditLog` table is written by a Prisma middleware hook on all mutations to
`CreditCard`, `SecurityControl`, `Payment`, and `CreditCardApplication`. It is
**append-only** — no UPDATE or DELETE operations are permitted on this table.

---

## Key Prisma Middleware Hooks

| Hook | Trigger | Action |
|---|---|---|
| `auditLog` | Any write to Card, Security, Payment, Application | Append AuditLog record |
| `softDelete` | `delete` on User | Convert to `update { deletedAt: now() }` |
| `sensitiveFieldRedact` | `findMany/findUnique` on User where `deletedAt != null` | Redact PII fields |
| `balanceRecalc` | Transaction `create` / `update` | Update `CreditCard.currentBalance` atomically |
