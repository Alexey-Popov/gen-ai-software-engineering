---
description: Run the multi-agent banking pipeline end-to-end and summarize results.
---

Run the multi-agent banking pipeline end-to-end.

Steps:
1. Check that `sample-transactions.json` exists in the `homework-6` directory.
2. Clear the `shared/` directories (the integrator does this automatically on each run).
3. Run the pipeline: `python integrator.py`.
4. Show a summary of results from `shared/results/` (read `shared/results/pipeline-summary.json`).
5. Report any transactions that were rejected and why (the `rejected` list in the summary,
   each with its `transaction_id` and `reason`).

Also note how many transactions were flagged for fraud review, placed on compliance hold,
and successfully settled.
