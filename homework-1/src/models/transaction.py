from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_CURRENCIES = {
    "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "HKD", "SGD",
    "NOK", "SEK", "DKK", "NZD", "MXN", "INR", "BRL", "ZAR", "RUB", "TRY",
}

_ACCOUNT_RE = re.compile(r"^ACC-[A-Z0-9]{5}$")


class TransactionCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "fromAccount": "ACC-12345",
            "toAccount": "ACC-67890",
            "amount": 100.50,
            "currency": "USD",
            "type": "transfer",
        }
    })

    fromAccount: str = Field(
        description="Source account. Format: ACC-XXXXX (5 uppercase alphanumeric characters after the dash)",
        json_schema_extra={"example": "ACC-12345"},
    )
    toAccount: str = Field(
        description="Destination account. Format: ACC-XXXXX (5 uppercase alphanumeric characters after the dash)",
        json_schema_extra={"example": "ACC-67890"},
    )
    amount: float = Field(
        description="Transaction amount — must be positive with at most 2 decimal places",
        json_schema_extra={"example": 100.50},
    )
    currency: str = Field(
        description="ISO 4217 currency code. Accepted: USD, EUR, GBP, JPY, CHF, CAD, AUD, CNY, HKD, SGD, NOK, SEK, DKK, NZD, MXN, INR, BRL, ZAR, RUB, TRY",
        json_schema_extra={"example": "USD"},
    )
    type: Literal["deposit", "withdrawal", "transfer"] = Field(
        description="Transaction type",
        json_schema_extra={"example": "transfer"},
    )

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be a positive number with at most 2 decimal places")
        if Decimal(str(v)).as_tuple().exponent < -2:
            raise ValueError("Amount must be a positive number with at most 2 decimal places")
        return v

    @field_validator("fromAccount", "toAccount")
    @classmethod
    def validate_account(cls, v: str) -> str:
        if not _ACCOUNT_RE.match(v):
            raise ValueError("Account number must follow format ACC-XXXXX")
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v.upper() not in VALID_CURRENCIES:
            raise ValueError("Invalid currency code")
        return v.upper()


class Transaction(TransactionCreate):
    id: str
    timestamp: datetime
    status: Literal["pending", "completed", "failed"] = "completed"


class ErrorDetail(BaseModel):
    field: str = Field(json_schema_extra={"example": "fromAccount"})
    message: str = Field(json_schema_extra={"example": "Account number must follow format ACC-XXXXX"})


class ErrorResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "error": "Validation failed",
            "details": [
                {"field": "fromAccount", "message": "Account number must follow format ACC-XXXXX"},
                {"field": "currency", "message": "Invalid currency code"},
            ],
        }
    })

    error: str = Field(json_schema_extra={"example": "Validation failed"})
    details: list[ErrorDetail]


transactions_db: dict[str, Transaction] = {}


def create_transaction(data: TransactionCreate) -> Transaction:
    tx = Transaction(
        id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc),
        status="completed",
        **data.model_dump(),
    )
    transactions_db[tx.id] = tx
    return tx
