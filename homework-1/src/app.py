from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.routes.accounts import router as accounts_router
from src.routes.transactions import router as transactions_router

app = FastAPI(
    title="Banking Transactions API",
    description="Simple REST API for banking transactions — Homework 1, AI-Assisted Development course.",
    version="1.0.0",
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for error in exc.errors():
        field = str(error["loc"][-1]) if error["loc"] else "unknown"
        msg = error["msg"]
        # Strip Pydantic v2 "Value error, " prefix so messages stay clean
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        details.append({"field": field, "message": msg})
    return JSONResponse(
        status_code=400,
        content={"error": "Validation failed", "details": details},
    )


app.include_router(transactions_router)
app.include_router(accounts_router)
