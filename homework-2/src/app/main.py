from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.imports import router as imports_router
from app.api.tickets import router as tickets_router

app = FastAPI(title="Support Tickets API")

app.include_router(tickets_router)
app.include_router(imports_router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for err in exc.errors():
        loc = err.get("loc", ())
        field = loc[-1] if loc else "body"
        if field == "body":
            field = loc[1] if len(loc) > 1 else "body"
        details.append({"field": str(field), "message": err["msg"]})
    return JSONResponse(
        status_code=400,
        content={"error": "Validation failed", "details": details},
    )
