from __future__ import annotations

from fastapi import APIRouter

from src.models.transaction import transactions_db

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.get("/{accountId}/balance")
def get_balance(accountId: str) -> dict:
    txs = list(transactions_db.values())
    account_txs = [t for t in txs if t.fromAccount == accountId or t.toAccount == accountId]

    inflows = sum(t.amount for t in txs if t.toAccount == accountId)
    outflows = sum(t.amount for t in txs if t.fromAccount == accountId)
    balance = round(inflows - outflows, 2)
    currency = account_txs[-1].currency if account_txs else "USD"

    return {"accountId": accountId, "balance": balance, "currency": currency}


@router.get("/{accountId}/summary")
def get_summary(accountId: str) -> dict:
    txs = [
        t for t in transactions_db.values()
        if t.fromAccount == accountId or t.toAccount == accountId
    ]

    total_deposits = round(sum(t.amount for t in txs if t.type == "deposit"), 2)
    total_withdrawals = round(sum(t.amount for t in txs if t.type == "withdrawal"), 2)
    most_recent = max((t.timestamp for t in txs), default=None)

    return {
        "accountId": accountId,
        "totalDeposits": total_deposits,
        "totalWithdrawals": total_withdrawals,
        "transactionCount": len(txs),
        "mostRecentDate": most_recent,
    }
