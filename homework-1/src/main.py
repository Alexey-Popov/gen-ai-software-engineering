from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.rate_limit import RateLimiter, RateLimitMiddleware
from src.routers import accounts, transactions

app = FastAPI(title="Banking Transactions API", version="1.0.0")

app.state.rate_limiter = RateLimiter(max_requests=100, window_seconds=60)
app.add_middleware(RateLimitMiddleware)

app.include_router(transactions.router)
app.include_router(accounts.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = [
        {"field": ".".join(str(p) for p in error["loc"][1:]) or str(error["loc"][-1]), "message": error["msg"]}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=400, content={"error": "Validation failed", "details": details})


@app.get("/")
async def health_check():
    return {"status": "ok", "service": "banking-transactions-api"}
