from fastapi import APIRouter

from src.storage import store

router = APIRouter()


@router.get("/accounts/{account_id}/balance")
async def get_balance(account_id: str):
    return {"accountId": account_id, "balances": store.balance(account_id)}


@router.get("/accounts/{account_id}/summary")
async def get_summary(account_id: str):
    summary = store.summary(account_id)
    most_recent = summary["mostRecentTransactionDate"]
    summary["mostRecentTransactionDate"] = most_recent.isoformat() if most_recent else None
    return summary
