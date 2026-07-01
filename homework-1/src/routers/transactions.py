import json
from datetime import date
from typing import Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from src.models import Transaction, TransactionType
from src.storage import store
from src.validators import validate_transaction_payload

router = APIRouter()


@router.post("/transactions", status_code=201, response_model=Transaction)
async def create_transaction(request: Request):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return JSONResponse(
            status_code=400,
            content={"error": "Validation failed", "details": [{"field": "body", "message": "Request body must be valid JSON"}]},
        )

    if not isinstance(payload, dict):
        return JSONResponse(
            status_code=400,
            content={"error": "Validation failed", "details": [{"field": "body", "message": "Request body must be a JSON object"}]},
        )

    errors = validate_transaction_payload(payload)
    if errors:
        return JSONResponse(status_code=400, content={"error": "Validation failed", "details": errors})

    transaction = Transaction(
        fromAccount=payload["fromAccount"],
        toAccount=payload["toAccount"],
        amount=round(float(payload["amount"]), 2),
        currency=payload["currency"].upper(),
        type=payload["type"],
    )
    store.add(transaction)
    return transaction


@router.get("/transactions", response_model=list[Transaction])
async def list_transactions(
    accountId: Optional[str] = None,
    type: Optional[TransactionType] = None,
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
):
    return store.list(
        account_id=accountId,
        tx_type=type.value if type else None,
        date_from=from_date,
        date_to=to_date,
    )


@router.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: str):
    transaction = store.get_by_id(transaction_id)
    if transaction is None:
        return JSONResponse(status_code=404, content={"error": "Transaction not found"})
    return transaction
