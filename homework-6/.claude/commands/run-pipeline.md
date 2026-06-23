---
description: Run the multi-agent banking pipeline end-to-end and summarize results.
---

Run the multi-agent banking pipeline end-to-end (REST services + master agent).

Steps:
1. Check that `sample-transactions.json` exists in the `homework-6` directory.
2. Run the full demo: `./demo.sh` (it starts every service, submits the samples through the REST
   gateway, prints results, and tears the fleet down). Alternatively, with the services already
   running via `python run_services.py`, run `python integrator.py`.
3. Read the run summary from `shared/results/pipeline-summary.json` (or
   `GET http://127.0.0.1:8000/api/v1/pipeline/summary`).
4. Report any transactions that were rejected and why (the `rejected` list in the summary,
   each with its `transaction_id` and `reason`).

Also note how many transactions were flagged for fraud review, placed on compliance hold,
and successfully settled.
