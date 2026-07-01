import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from .models import (
    InterestResponse,
    SummaryResponse,
    Transaction,
    TransactionRequest,
    TransactionStatus,
    TransactionType,
)
from .store import TransactionStore

_ZERO = Decimal("0")
_CENTS = Decimal("0.01")
_YEAR = Decimal("365")


class TransactionService:
    def __init__(self, store: TransactionStore) -> None:
        self.store = store

    def create(self, req: TransactionRequest) -> Transaction:
        transaction = Transaction(
            id=str(uuid.uuid4()),
            fromAccount=req.fromAccount,
            toAccount=req.toAccount,
            amount=req.amount,
            currency=req.currency,
            type=req.type,
            timestamp=datetime.now(timezone.utc),
            status=TransactionStatus.completed,
        )
        return self.store.save(transaction)

    def find_all(self) -> list[Transaction]:
        return self.store.find_all()

    def find_by_id(self, transaction_id: str) -> Optional[Transaction]:
        return self.store.find_by_id(transaction_id)

    def find(
        self,
        account_id: Optional[str] = None,
        tx_type: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list[Transaction]:
        result: list[Transaction] = []
        for t in self.store.find_all():
            if account_id and t.fromAccount != account_id and t.toAccount != account_id:
                continue
            if tx_type and t.type.value != tx_type:
                continue
            day = t.timestamp.date()
            if date_from and day < date_from:
                continue
            if date_to and day > date_to:  # inclusive upper bound
                continue
            result.append(t)
        return result


class AccountService:
    def __init__(self, store: TransactionStore) -> None:
        self.store = store

    def balance_of(self, account_id: str) -> Decimal:
        balance = _ZERO
        for t in self.store.find_all():
            if t.status != TransactionStatus.completed:
                continue
            if t.type == TransactionType.deposit and t.toAccount == account_id:
                balance += t.amount
            elif t.type == TransactionType.withdrawal and t.fromAccount == account_id:
                balance -= t.amount
            elif t.type == TransactionType.transfer:
                if t.fromAccount == account_id:
                    balance -= t.amount
                if t.toAccount == account_id:
                    balance += t.amount
        return balance

    def summary_of(self, account_id: str) -> SummaryResponse:
        deposits = _ZERO
        withdrawals = _ZERO
        count = 0
        most_recent: Optional[datetime] = None
        for t in self.store.find_all():
            if t.fromAccount != account_id and t.toAccount != account_id:
                continue
            count += 1
            if most_recent is None or t.timestamp > most_recent:
                most_recent = t.timestamp
            if t.status == TransactionStatus.completed:
                if t.type == TransactionType.deposit and t.toAccount == account_id:
                    deposits += t.amount
                elif t.type == TransactionType.withdrawal and t.fromAccount == account_id:
                    withdrawals += t.amount
        return SummaryResponse(
            totalDeposits=deposits,
            totalWithdrawals=withdrawals,
            transactionCount=count,
            mostRecentTransactionDate=most_recent,
        )

    def interest(self, account_id: str, rate: Decimal, days: int) -> InterestResponse:
        if rate < 0:
            raise ValueError("rate must be zero or positive")
        if days <= 0:
            raise ValueError("days must be a positive integer")
        balance = self.balance_of(account_id)
        value = (balance * rate * Decimal(days) / _YEAR).quantize(_CENTS, rounding=ROUND_HALF_UP)
        return InterestResponse(
            accountId=account_id, balance=balance, rate=rate, days=days, interest=value
        )
