from datetime import date, datetime
from typing import Dict, List, Optional

from src.models import Transaction, TransactionStatus


class TransactionStore:
    """In-memory storage for transactions. No database required per assignment scope."""

    def __init__(self) -> None:
        self._transactions: List[Transaction] = []

    def reset(self) -> None:
        self._transactions.clear()

    def add(self, transaction: Transaction) -> Transaction:
        self._transactions.append(transaction)
        return transaction

    def get_by_id(self, transaction_id: str) -> Optional[Transaction]:
        for transaction in self._transactions:
            if transaction.id == transaction_id:
                return transaction
        return None

    def list(
        self,
        account_id: Optional[str] = None,
        tx_type: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[Transaction]:
        results = self._transactions
        if account_id:
            results = [t for t in results if account_id in (t.fromAccount, t.toAccount)]
        if tx_type:
            results = [t for t in results if t.type == tx_type]
        if date_from:
            results = [t for t in results if t.timestamp.date() >= date_from]
        if date_to:
            results = [t for t in results if t.timestamp.date() <= date_to]
        return results

    def balance(self, account_id: str) -> Dict[str, float]:
        """Net balance per currency, based on completed transactions only.

        Type-aware: a deposit only credits toAccount and a withdrawal only debits
        fromAccount (the other side represents an external source/destination, not
        a tracked balance movement); a transfer both debits and credits.
        """
        balances: Dict[str, float] = {}

        def credit(currency: str, amount: float) -> None:
            balances[currency] = round(balances.get(currency, 0.0) + amount, 2)

        def debit(currency: str, amount: float) -> None:
            balances[currency] = round(balances.get(currency, 0.0) - amount, 2)

        for t in self._transactions:
            if t.status != TransactionStatus.completed:
                continue
            if t.type == "deposit" and t.toAccount == account_id:
                credit(t.currency, t.amount)
            elif t.type == "withdrawal" and t.fromAccount == account_id:
                debit(t.currency, t.amount)
            elif t.type == "transfer":
                if t.toAccount == account_id:
                    credit(t.currency, t.amount)
                if t.fromAccount == account_id:
                    debit(t.currency, t.amount)
        return balances

    def summary(self, account_id: str) -> dict:
        """Deposits/withdrawals per currency plus overall transaction count for an account."""
        deposits: Dict[str, float] = {}
        withdrawals: Dict[str, float] = {}
        involved: List[Transaction] = []

        for t in self._transactions:
            if account_id not in (t.fromAccount, t.toAccount):
                continue
            involved.append(t)
            if t.status != TransactionStatus.completed:
                continue
            if t.type == "deposit" and t.toAccount == account_id:
                deposits[t.currency] = round(deposits.get(t.currency, 0.0) + t.amount, 2)
            if t.type == "withdrawal" and t.fromAccount == account_id:
                withdrawals[t.currency] = round(withdrawals.get(t.currency, 0.0) + t.amount, 2)

        most_recent: Optional[datetime] = max((t.timestamp for t in involved), default=None)

        return {
            "accountId": account_id,
            "totalDeposits": deposits,
            "totalWithdrawals": withdrawals,
            "transactionCount": len(involved),
            "mostRecentTransactionDate": most_recent,
        }


# Single shared in-memory store for the app's lifetime.
store = TransactionStore()
