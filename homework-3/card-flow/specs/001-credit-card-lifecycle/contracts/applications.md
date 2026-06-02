# API Contract: Card Applications

**Base path**: `/api/v1/applications`
**Auth**: Unauthenticated for draft creation; Bearer JWT required for all other operations.
**Error format**: RFC 9457 `application/problem+json`

---

## POST /api/v1/applications

Create or update a draft application. Unauthenticated users receive a `guestToken` to
present in subsequent calls until they authenticate.

### Request body

```json
{
  "guestToken": "string | null",
  "productType": "Cashback Platinum",
  "firstName": "Jane",
  "lastName": "Smith",
  "dateOfBirth": "1990-04-15",
  "annualIncome": 72000.00,
  "employmentStatus": "EMPLOYED",
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "US",
  "ssnLastFour": "4321"
}
```

**Required fields**: `productType`, `firstName`, `lastName`, `dateOfBirth`, `annualIncome`,
`employmentStatus`, `addressLine1`, `city`, `state`, `postalCode`, `country`.

`ssnLastFour` is required for submitted applications but may be omitted in drafts.

### Responses

**201 Created** — Draft created

```json
{
  "applicationId": "cuid",
  "guestToken": "opaque-string",
  "status": "DRAFT",
  "referenceNumber": null,
  "createdAt": "2026-06-03T10:00:00Z"
}
```

**200 OK** — Existing draft updated (matched by `guestToken` or authenticated userId)

```json
{
  "applicationId": "cuid",
  "status": "DRAFT",
  "updatedAt": "2026-06-03T10:05:00Z"
}
```

**422 Unprocessable Entity**

```json
{
  "type": "https://cardflow.example/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation.",
  "fields": {
    "dateOfBirth": "Applicant must be at least 18 years old."
  }
}
```

---

## POST /api/v1/applications/:id/submit

Submit a draft for underwriting review.

**Auth**: Bearer JWT **or** `X-Guest-Token` header with the draft's guest token.

### Responses

**200 OK**

```json
{
  "applicationId": "cuid",
  "referenceNumber": "CF-20260603-00001",
  "status": "SUBMITTED",
  "submittedAt": "2026-06-03T10:10:00Z",
  "estimatedDecisionBy": "2026-06-10T00:00:00Z"
}
```

**409 Conflict** — Application not in DRAFT status

```json
{
  "type": "https://cardflow.example/problems/invalid-status-transition",
  "title": "Invalid Status Transition",
  "status": 409,
  "detail": "Application CF-20260603-00001 is already SUBMITTED and cannot be submitted again."
}
```

**422 Unprocessable Entity** — Missing required fields (e.g., `ssnLastFour` not yet provided)

---

## GET /api/v1/applications

List all applications for the authenticated user.

**Auth**: Bearer JWT required.

### Response 200 OK

```json
{
  "applications": [
    {
      "applicationId": "cuid",
      "referenceNumber": "CF-20260603-00001",
      "status": "UNDER_REVIEW",
      "productType": "Cashback Platinum",
      "submittedAt": "2026-06-03T10:10:00Z",
      "decidedAt": null
    }
  ]
}
```

---

## GET /api/v1/applications/:id

Retrieve application details. User MUST own the application.

### Response 200 OK

```json
{
  "applicationId": "cuid",
  "referenceNumber": "CF-20260603-00001",
  "status": "APPROVED",
  "productType": "Cashback Platinum",
  "requestedCreditLimit": 8000.00,
  "approvedCreditLimit": 5000.00,
  "approvedApr": 0.1999,
  "declineReasonSummary": null,
  "adverseActionNoticeUrl": null,
  "submittedAt": "2026-06-03T10:10:00Z",
  "decidedAt": "2026-06-05T14:22:00Z"
}
```

**404 Not Found** — Application not found or not owned by requester.

---

## POST /api/v1/applications/:id/withdraw

Withdraw a pending application. Only permitted when status is `SUBMITTED` or `UNDER_REVIEW`.

**Auth**: Bearer JWT required.

### Response 200 OK

```json
{
  "applicationId": "cuid",
  "status": "WITHDRAWN"
}
```

**409 Conflict** — Application already decided or withdrawn.

---

## Internal Webhook: Underwriting Decision

`POST /internal/v1/applications/:id/decision`

This endpoint is called by the underwriting service. It is **not exposed** on the public
API gateway; it is accessible only from the internal VPC.

### Request body

```json
{
  "decision": "APPROVED",
  "approvedCreditLimit": 5000.00,
  "approvedApr": 0.1999,
  "declineReasonCode": null,
  "declineReasonSummary": null
}
```

**Side effects on APPROVED**:
1. `CreditCardApplication.status` → `APPROVED`; `decidedAt` set.
2. `CreditCard` record created with status `ISSUED_PENDING_ACTIVATION`.
3. `SecurityControl` record created (all defaults).
4. `APPLICATION_UPDATE` notification enqueued.

**Side effects on DECLINED**:
1. `CreditCardApplication.status` → `DECLINED`; `decidedAt` set.
2. Adverse-action PDF generated; uploaded to S3; signed URL stored in `adverseActionNoticeUrl`.
3. `APPLICATION_UPDATE` notification enqueued with notice URL.
