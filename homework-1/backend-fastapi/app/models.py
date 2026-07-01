from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated, Optional

from pydantic import BaseModel, Field, PlainSerializer, field_validator

# Serialize monetary Decimals as JSON numbers (e.g. 100.5), matching the API contract and
# the Angular client, while keeping Decimal precision for internal arithmetic.
Money = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]

# Accepted ISO 4217 currency codes (major world currencies); dependency-free set.
ISO4217 = {
    "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "HKD",
    "SGD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "TRY",
    "UAH", "INR", "BRL", "MXN", "ZAR", "KRW", "AED", "SAR", "ILS", "THB",
}


class TransactionType(str, Enum):
    deposit = "deposit"
    withdrawal = "withdrawal"
    transfer = "transfer"


class TransactionStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class TransactionRequest(BaseModel):
    fromAccount: str = Field(pattern=r"^ACC-[A-Za-z0-9]+$")
    toAccount: str = Field(pattern=r"^ACC-[A-Za-z0-9]+$")
    amount: Decimal = Field(gt=0, max_digits=20, decimal_places=2)
    currency: str
    type: TransactionType

    @field_validator("currency")
    @classmethod
    def valid_currency(cls, v: str) -> str:
        if v not in ISO4217:
            raise ValueError("Invalid currency code")
        return v


class Transaction(BaseModel):
    id: str
    fromAccount: str
    toAccount: str
    amount: Money
    currency: str
    type: TransactionType
    timestamp: datetime
    status: TransactionStatus


class SummaryResponse(BaseModel):
    totalDeposits: Money
    totalWithdrawals: Money
    transactionCount: int
    mostRecentTransactionDate: Optional[datetime]


class InterestResponse(BaseModel):
    accountId: str
    balance: Money
    rate: Money
    days: int
    interest: Money
