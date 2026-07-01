import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from .models import InterestResponse, SummaryResponse, Transaction, TransactionRequest
from .ratelimit import RateLimitMiddleware
from .services import AccountService, TransactionService
from .store import TransactionStore

CSV_HEADER = ["id", "fromAccount", "toAccount", "amount", "currency", "type", "timestamp", "status"]


def create_app(rate_limit: int = 100, window_seconds: int = 60) -> FastAPI:
    app = FastAPI(
        title="Banking Transactions API (FastAPI)",
        version="v1",
        description="REST API for banking transactions — Homework 1, FastAPI implementation. "
        "Same contract as the Java version. Interactive docs at /docs, spec at /openapi.json.",
    )

    store = TransactionStore()
    tx = TransactionService(store)
    acct = AccountService(store)
    app.state.store = store  # exposed so tests can seed/clear

    app.add_middleware(RateLimitMiddleware, limit=rate_limit, window_seconds=window_seconds)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(_request, exc: RequestValidationError):
        details = []
        for err in exc.errors():
            loc = err.get("loc", [])
            field = loc[-1] if loc else "body"
            details.append({"field": field, "message": err.get("msg", "invalid")})
        return JSONResponse(status_code=400, content={"error": "Validation failed", "details": details})

    @app.post("/transactions", status_code=201, response_model=Transaction)
    def create_transaction(req: TransactionRequest):
        return tx.create(req)

    @app.get("/transactions", response_model=list[Transaction])
    def list_transactions(
        accountId: Optional[str] = None,
        type: Optional[str] = None,
        from_: Optional[date] = Query(None, alias="from"),
        to: Optional[date] = None,
    ):
        return tx.find(accountId, type, from_, to)

    @app.get("/transactions/export")
    def export_csv(format: str = "csv"):
        if format != "csv":
            return JSONResponse(
                status_code=400,
                content={"error": "Bad request", "message": f"Unsupported export format: {format}"},
            )
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(CSV_HEADER)
        for t in tx.find_all():
            writer.writerow([
                t.id, t.fromAccount, t.toAccount, str(t.amount),
                t.currency, t.type.value, t.timestamp.isoformat(), t.status.value,
            ])
        return Response(
            content=buffer.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="transactions.csv"'},
        )

    @app.get("/transactions/{transaction_id}", response_model=Transaction)
    def get_transaction(transaction_id: str):
        found = tx.find_by_id(transaction_id)
        if found is None:
            return JSONResponse(
                status_code=404,
                content={"error": "Transaction not found", "id": transaction_id},
            )
        return found

    @app.get("/accounts/{account_id}/balance")
    def balance(account_id: str):
        return {"accountId": account_id, "balance": float(acct.balance_of(account_id))}

    @app.get("/accounts/{account_id}/summary", response_model=SummaryResponse)
    def summary(account_id: str):
        return acct.summary_of(account_id)

    @app.get("/accounts/{account_id}/interest", response_model=InterestResponse)
    def interest(account_id: str, rate: Optional[str] = None, days: Optional[str] = None):
        if rate is None or days is None:
            return JSONResponse(status_code=400, content={"error": "Bad request", "message": "rate and days are required"})
        try:
            rate_value = Decimal(rate)
        except InvalidOperation:
            return JSONResponse(status_code=400, content={"error": "Bad request", "message": "rate must be a number"})
        try:
            days_value = int(days)
        except ValueError:
            return JSONResponse(status_code=400, content={"error": "Bad request", "message": "days must be an integer"})
        try:
            return acct.interest(account_id, rate_value, days_value)
        except ValueError as exc:
            return JSONResponse(status_code=400, content={"error": "Bad request", "message": str(exc)})

    @app.get("/actuator/health")
    def health():
        return {"status": "UP"}

    return app


app = create_app()
