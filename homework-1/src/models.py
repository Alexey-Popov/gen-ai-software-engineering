from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


class TransactionType(str, Enum):
    deposit = "deposit"
    withdrawal = "withdrawal"
    transfer = "transfer"


class TransactionStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class TransactionCreate(BaseModel):
    fromAccount: str
    toAccount: str
    amount: float
    currency: str
    type: TransactionType


class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    fromAccount: str
    toAccount: str
    amount: float
    currency: str
    type: TransactionType
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: TransactionStatus = TransactionStatus.completed
