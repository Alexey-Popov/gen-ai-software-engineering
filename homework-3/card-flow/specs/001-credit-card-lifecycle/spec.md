# Feature Specification: CardFlow — Credit Card Lifecycle Management

**Feature Branch**: `001-credit-card-lifecycle`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "Design a specification package for a finance-oriented web/mobile
application that enables users to manage their credit cards throughout the entire card lifecycle."

---

## Overview

CardFlow gives consumers a single, trusted place to manage every stage of their credit card
relationship — from first application to everyday use. It removes the need to call a support
line for routine tasks, puts security controls directly in the cardholder's hands, and gives
people the transparency they need to stay on top of their finances.

**Target Users**

- **Active Cardholders** — People who already hold one or more credit cards and want a
  clear, up-to-date view of their balances, transactions, and payment obligations in one
  place.
- **Prospective Applicants** — Consumers who want to apply for a new credit card and follow
  the progress of their application without visiting a branch or waiting on hold.
- **Security-Conscious Users** — Cardholders who want to respond quickly to suspected fraud
  or control exactly where and how their card can be used, without waiting for business hours.

**Business Goals**

1. Reduce inbound customer-service calls by enabling cardholders to self-serve across every
   lifecycle stage.
2. Increase card activation rates by surfacing activation as the first action on a newly
   issued card.
3. Improve on-time payment rates through proactive reminders and simple payment flows.
4. Reduce fraud-related losses by giving cardholders instant, 24/7 security controls.
5. Increase cardholder engagement and retention through transparent, personalised spending
   insights.
6. Maintain full compliance with applicable consumer financial regulations and data-privacy
   laws.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Apply for a Credit Card & Track Application Status (Priority: P1)

A prospective customer wants to apply for a credit card through the app and know, at every
step, where their application stands — without having to call anyone.

**Why this priority**: New card acquisition is the primary revenue driver. A smooth, self-
service application journey reduces drop-off and lowers acquisition cost.

**Independent Test**: A new user can fill in an application form, submit it, and immediately
see a confirmation screen with their application reference number — testable in full before
any underwriting integration is in place.

**Acceptance Scenarios**:

1. **Given** a prospective customer on the application screen,
   **When** they complete all required personal and financial details and submit,
   **Then** the system confirms receipt with a unique reference number and a plain-language
   message explaining the expected timeline.

2. **Given** a submitted application,
   **When** the application is approved,
   **Then** the cardholder sees the approval in-app (credit limit, rate, card type) and is
   asked to review and accept the card agreement before the account is opened.

3. **Given** a submitted application,
   **When** the application is declined,
   **Then** the cardholder sees a plain-language summary of the reason and is provided the
   legally required adverse-action notice.

4. **Given** a user who started but did not submit an application,
   **When** they return to the app later,
   **Then** their draft is waiting for them and they can continue from where they left off.

5. **Given** an application that has been under review for more than seven business days,
   **When** no decision has been made,
   **Then** the cardholder receives a status-update notification and can see the updated
   status in the app.

---

### User Story 2 — Activate a New Card (Priority: P2)

A cardholder who has received a new physical or virtual card wants to activate it quickly so
they can start using it.

**Why this priority**: Unactivated cards generate no value and increase fraud risk. Reducing
friction between card receipt and first use directly improves business outcomes.

**Independent Test**: Given an approved, unactivated card account, a user can complete
activation through the app in a single flow — testable without any other story being
complete.

**Acceptance Scenarios**:

1. **Given** a cardholder with an unactivated card,
   **When** they open the app,
   **Then** they see a clear, prominent prompt to activate their card.

2. **Given** a cardholder going through activation,
   **When** they confirm the card details and their identity,
   **Then** the card is activated immediately and they can begin using it for purchases.

3. **Given** incorrect card details are entered during activation,
   **When** the user submits,
   **Then** they are told the details do not match and how many further attempts they have.

4. **Given** three failed activation attempts,
   **When** the third attempt fails,
   **Then** the activation flow is locked and the user is directed to contact support with
   a clear explanation of why.

---

### User Story 3 — View Account Overview: Balance, Transactions & Credit Limit (Priority: P3)

An active cardholder wants a real-time picture of their account — current balance, available
credit, and a detailed transaction history — so they can manage their spending confidently.

**Why this priority**: Transaction visibility is the most frequently accessed function in
any card app; it underpins trust and is the foundation for all other financial management
features.

**Independent Test**: Given an active card with transactions, a user can open the account
overview and see balance, available credit, and a transaction list — testable without
payment or insights features.

**Acceptance Scenarios**:

1. **Given** an active cardholder on the account overview,
   **When** the screen loads,
   **Then** they see their current balance, available credit, credit limit, next statement
   closing date, and minimum payment due — all in plain language.

2. **Given** a new transaction on the account,
   **When** the cardholder views their transaction list,
   **Then** the new transaction appears within 60 seconds and the balance reflects the
   change.

3. **Given** a cardholder who wants to narrow their transaction view,
   **When** they apply a date range or spending-category filter,
   **Then** only matching transactions are shown and totals update accordingly.

4. **Given** a cardholder who taps a transaction,
   **When** the detail view opens,
   **Then** they see the merchant name, date and time, amount, spending category, and
   whether the transaction is pending or settled.

---

### User Story 4 — Make and Schedule Payments (Priority: P4)

A cardholder wants to pay their credit card bill — immediately or on a future date — and set
up automatic recurring payments so they never miss a due date.

**Why this priority**: On-time payments protect cardholder credit scores, reduce late-fee
disputes, and directly improve portfolio health.

**Independent Test**: Given a card with a balance and a linked bank account, a user can
initiate and confirm a one-time payment — testable independently of autopay configuration.

**Acceptance Scenarios**:

1. **Given** a cardholder making a payment,
   **When** they choose an amount (minimum, full statement balance, or a custom figure) and
   a source account,
   **Then** they see a clear confirmation screen before the payment is processed, showing
   the amount, source, and expected posting date.

2. **Given** a confirmed payment,
   **When** it is processed successfully,
   **Then** the cardholder receives a confirmation notification and their account balance
   updates accordingly.

3. **Given** a cardholder setting up automatic payments,
   **When** they select the payment amount type (minimum, full statement, or fixed amount)
   and preferred date,
   **Then** the autopay rule is saved, the next payment date is shown, and a reminder is
   sent three days before each payment.

4. **Given** a scheduled payment where the linked account has insufficient funds,
   **When** the payment date arrives,
   **Then** the payment fails, the cardholder is notified with a clear reason, and no late
   fee is applied for their first such occurrence in a twelve-month period.

---

### User Story 5 — Manage Card Security Controls (Priority: P5)

A cardholder wants to freeze or unfreeze their card instantly, restrict specific types of
transactions, and report a card as lost or stolen — without waiting on hold.

**Why this priority**: Instant security controls are a key differentiator, directly reduce
fraud losses, and give cardholders the confidence to engage more with the product.

**Independent Test**: Given an active card, a user can freeze it with a single tap and
confirm it is locked — independently testable via a simulated transaction attempt.

**Acceptance Scenarios**:

1. **Given** a cardholder on the security settings screen,
   **When** they freeze their card and confirm their identity,
   **Then** the card is locked within five seconds and any new purchase attempts are
   declined while any transactions already in progress are unaffected.

2. **Given** a frozen card,
   **When** the cardholder unfreezes it and confirms their identity,
   **Then** the card is active again within five seconds and can be used normally.

3. **Given** a cardholder enabling a transaction restriction,
   **When** they turn on "Block international transactions",
   **Then** any purchase attempt with a foreign merchant is declined until the restriction
   is turned off.

4. **Given** a cardholder who reports their card as lost or stolen,
   **When** they submit the report,
   **Then** the card is permanently blocked, a replacement is automatically ordered, and
   the expected delivery window is shown.

---

### User Story 6 — Receive Smart Notifications and Alerts (Priority: P6)

A cardholder wants personalised alerts for large transactions, payment due dates, balance
thresholds, and suspicious activity so they stay informed without being overwhelmed.

**Why this priority**: Proactive, relevant notifications reduce fraud losses, prevent missed
payments, and increase app engagement and retention.

**Independent Test**: Given a cardholder who has set a large-transaction alert, a simulated
qualifying transaction triggers a push notification — testable without needing other
notification types active.

**Acceptance Scenarios**:

1. **Given** a cardholder with a transaction alert set,
   **When** a qualifying transaction occurs,
   **Then** they receive a notification within 60 seconds that includes the merchant name,
   amount, and a one-tap option to flag it as unrecognised.

2. **Given** a cardholder with a payment reminder active,
   **When** a payment due date is three days away,
   **Then** a reminder notification is sent with the minimum amount due, the due date, and
   a direct link to the payment screen.

3. **Given** a cardholder who taps "That wasn't me" on a transaction notification,
   **When** they confirm the dispute,
   **Then** the transaction is flagged for investigation, the card is automatically frozen,
   and a case reference number is displayed.

---

### User Story 7 — View Spending Insights and Reports (Priority: P7)

A cardholder wants to understand their spending patterns — by category, merchant, and time
period — so they can make more informed financial decisions.

**Why this priority**: Spending insights increase app value and stickiness, differentiating
the product from basic card management tools. Lower priority because they depend on
sufficient transaction history existing.

**Independent Test**: Given a card with several months of transactions, a user can navigate
to the Insights screen and see a category breakdown for the current month — testable with
read-only historical data.

**Acceptance Scenarios**:

1. **Given** a cardholder on the Insights screen,
   **When** it loads,
   **Then** they see a clear breakdown of their spending by category (e.g., Dining, Travel,
   Shopping) with amounts and percentages for their selected time period.

2. **Given** a cardholder exploring a spending category,
   **When** they tap into it,
   **Then** they see the merchants within that category and a comparison with the same
   period in the previous month.

3. **Given** a cardholder who has set a monthly spending budget for a category,
   **When** their spending in that category reaches 80% of the budget,
   **Then** they receive an alert: "You've used 80% of your Dining budget this month."

---

### Edge Cases

- What happens when the application service is unavailable during submission? — The system
  saves the draft and notifies the user when it can retry, rather than losing their data.
- What happens if a payment gateway does not respond? — The system tells the user the
  outcome is uncertain, does not attempt a second charge, and confirms the result as soon
  as it is known.
- What happens if card freeze fails due to a connectivity issue? — The card is shown as
  "freeze pending" and is not shown as frozen until the change is confirmed; the user is
  notified when it completes.
- What happens when a user has multiple cards? — All cards appear on the home dashboard;
  every journey (activation, payment, security, insights) operates on the selected card
  with clear identification.
- What happens if biometric authentication fails during a security action? — The user may
  fall back to a PIN. After repeated failures the action is locked and the user is directed
  to contact support.

---

## Requirements *(mandatory)*

### Functional Requirements

**Card Application & Status**

- **FR-001**: Users MUST be able to start a credit card application without first creating
  an account, and MUST be able to save and resume a draft application.
- **FR-002**: The application MUST collect all information required for a credit decision:
  legal name, date of birth, address, annual income, and employment status.
- **FR-003**: Users MUST be able to view the real-time status of their application at any
  time: Draft, Submitted, Under Review, Approved, Declined, or Withdrawn.
- **FR-004**: When an application is declined, the system MUST provide a plain-language
  reason summary and MUST make the legally required adverse-action notice available to the
  applicant.
- **FR-005**: Users MUST be able to withdraw a pending application before a decision is
  reached.

**Card Activation**

- **FR-006**: Cardholders with an unactivated card MUST see a clear activation prompt when
  they open the app.
- **FR-007**: Activation MUST require the cardholder to confirm card details and verify
  their identity.
- **FR-008**: The card MUST be active and ready for use within five seconds of successful
  activation.
- **FR-009**: After three failed activation attempts the activation flow MUST be locked and
  the cardholder MUST be directed to contact support.

**Account Overview**

- **FR-010**: The account overview MUST display current balance, available credit, credit
  limit, next statement closing date, and minimum payment due.
- **FR-011**: The transaction list MUST be presented in reverse chronological order, showing
  merchant name, date, amount, spending category, and settlement status for each item.
- **FR-012**: Cardholders MUST be able to filter transactions by date range and spending
  category.
- **FR-013**: Balance and transaction data MUST refresh automatically so new transactions
  appear within 60 seconds of occurring.

**Payments**

- **FR-014**: Cardholders MUST be able to make a one-time payment in the amount of the
  minimum payment, full statement balance, current balance, or a custom amount.
- **FR-015**: A clear confirmation step MUST be presented before any payment is processed,
  showing the amount, funding source, and expected posting date.
- **FR-016**: Cardholders MUST be able to set up automatic recurring payments, specifying
  the payment amount type and preferred date.
- **FR-017**: A payment reminder notification MUST be sent at least three days before any
  scheduled or due payment.
- **FR-018**: The system MUST prevent an identical payment from being submitted twice within
  a 60-second window.

**Security Controls**

- **FR-019**: Cardholders MUST be able to freeze and unfreeze their card at any time; the
  change MUST take effect within five seconds.
- **FR-020**: Identity re-verification (PIN or biometric) MUST be required before any
  security control change is applied.
- **FR-021**: Cardholders MUST be able to restrict specific transaction types: international
  purchases, online-only purchases, and ATM/cash withdrawals.
- **FR-022**: Cardholders MUST be able to report a card lost or stolen; the card MUST be
  permanently blocked and a replacement MUST be automatically ordered.

**Notifications**

- **FR-023**: Cardholders MUST be able to configure personalised alert thresholds for
  transactions, payment due dates, and account balance.
- **FR-024**: Transaction alerts MUST be delivered within 60 seconds of the transaction
  occurring.
- **FR-025**: Cardholders MUST be able to view a history of all alerts they have received
  in the past 90 days within the app.
- **FR-026**: A one-tap "That wasn't me" action on a transaction alert MUST initiate a
  dispute and automatically freeze the card.

**Spending Insights**

- **FR-027**: The app MUST categorise transactions automatically and display a spending
  breakdown by category for user-selected time periods.
- **FR-028**: Cardholders MUST be able to set a monthly spending budget per category, with
  an alert when 80% of the budget is reached.
- **FR-029**: The app MUST show a month-over-month spending comparison for each category.

### Key Entities *(include if feature involves data)*

- **Cardholder** — A verified user who holds one or more credit cards. Has personal
  details, contact preferences, and notification settings.
- **Application** — A request to open a new credit card account. Has a status lifecycle
  from Draft through to Approved or Declined, and carries the supporting documentation.
- **Credit Card** — An issued card account with a credit limit, current balance, APR, and
  a status reflecting its lifecycle stage (e.g., Pending Activation, Active, Frozen,
  Closed).
- **Transaction** — An individual debit or credit event on a card, with merchant details,
  amount, category, and settlement status.
- **Payment** — An outbound transfer from a linked bank account to the credit card, either
  one-time or part of a recurring schedule.
- **Security Control** — Per-card settings governing whether the card is frozen and which
  transaction types are permitted.
- **Notification** — A message sent to the cardholder across one or more channels (push,
  email, in-app) with a delivery record and read status.
- **Spending Budget** — A user-defined limit on spending in a category over a given period,
  with an alert threshold.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of credit card applications are completed and submitted without
  the applicant contacting customer support.
- **SC-002**: Card activation completion rate reaches 85% or higher among cardholders who
  receive a new card.
- **SC-003**: At least 70% of active cardholders enrol in automatic payments within 30 days
  of activating their card.
- **SC-004**: Fraud-related chargebacks decrease by 25% within six months of the security
  controls feature going live.
- **SC-005**: Transaction alerts reach the cardholder within 60 seconds of the transaction
  at least 95% of the time.
- **SC-006**: Cardholders can view their account overview in two seconds or less on a
  standard mobile connection at least 95% of the time.
- **SC-007**: Zero regulatory compliance failures relating to required consumer disclosures
  are identified in post-launch audits.
- **SC-008**: At least 60% of total cardholders use the app at least once a month within
  90 days of launch.

---

## Assumptions

- Cardholders access the application through a smartphone (iOS or Android) or a modern web
  browser.
- An existing card-issuing and processing platform provides the underlying card management,
  transaction feed, and authorisation capabilities. CardFlow integrates with this platform
  but does not replace it.
- Identity verification during the application process is handled by an accredited third-
  party service; CardFlow captures the required information and passes it through.
- Bank account linking for payments is handled through a separate enrolment flow using an
  established open-banking or direct-debit service; this flow is outside the scope of this
  specification.
- Push notification delivery uses the standard platform notification services available on
  iOS and Android.
- A cardholder may hold between one and five credit cards; the app supports all of them.
- The application is required to comply with applicable consumer financial regulations,
  including requirements around credit disclosures, adverse-action notices, and data
  privacy. Specific regulatory frameworks will be confirmed during planning based on the
  target markets.
- Offline access to cached data (last-known balances, recent transactions) is desirable
  for v1 but not required; all writes (payments, security changes) require connectivity.
