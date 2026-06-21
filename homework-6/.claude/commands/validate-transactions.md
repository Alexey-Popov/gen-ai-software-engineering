---
description: Validate all transactions without running the full pipeline (dry run).
---

Validate all transactions in `sample-transactions.json` without processing them.

Steps:
1. Run the validator in dry-run mode: `python agents/transaction_validator.py --dry-run`.
2. Report: total count, valid count, invalid count, and the reason for each rejection.
3. Show a table of results (transaction id, currency, amount, VALID/INVALID, reason).

Do not run the fraud detector, compliance checker, settlement processor, or write any files —
this is a read-only validation pass.
