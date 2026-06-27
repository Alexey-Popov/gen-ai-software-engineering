from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from src.models.transaction import (
    ErrorResponse,
    Transaction,
    TransactionCreate,
    create_transaction,
    transactions_db,
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post(
    "",
    response_model=Transaction,
    status_code=201,
    responses={400: {"model": ErrorResponse, "description": "Validation failed — invalid field values"}},
)
def post_transaction(body: TransactionCreate) -> Transaction:
    return create_transaction(body)


@router.get("", response_model=list[Transaction])
def list_transactions(
    accountId: Optional[str] = Query(None, description="Filter by account (from or to)"),
    type: Optional[str] = Query(None, description="Filter by type: deposit | withdrawal | transfer"),
    from_date: Optional[date] = Query(None, alias="from", description="Start date inclusive, e.g. 2024-01-01"),
    to_date: Optional[date] = Query(None, alias="to", description="End date inclusive, e.g. 2024-01-31"),
) -> list[Transaction]:
    results = list(transactions_db.values())

    if accountId:
        results = [t for t in results if t.fromAccount == accountId or t.toAccount == accountId]
    if type:
        results = [t for t in results if t.type == type]
    if from_date:
        cutoff = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        results = [t for t in results if t.timestamp >= cutoff]
    if to_date:
        cutoff = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
        results = [t for t in results if t.timestamp <= cutoff]

    return results


@router.get(
    "/{transaction_id}",
    response_model=Transaction,
    responses={404: {"description": "Transaction not found", "content": {"application/json": {"example": {"detail": "Transaction not found"}}}}},
)
def get_transaction(transaction_id: str) -> Transaction:
    tx = transactions_db.get(transaction_id)
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx
