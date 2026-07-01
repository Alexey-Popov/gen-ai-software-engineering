package service

import (
	"errors"
	"time"

	"github.com/shopspring/decimal"

	"bankingapi/internal/model"
	"bankingapi/internal/store"
)

var daysInYear = decimal.NewFromInt(365)

// Interest is a simple-interest calculation result (Task 4B).
type Interest struct {
	AccountID string          `json:"accountId"`
	Balance   decimal.Decimal `json:"balance"`
	Rate      decimal.Decimal `json:"rate"`
	Days      int             `json:"days"`
	Interest  decimal.Decimal `json:"interest"`
}

// Summary is an account activity summary (Task 4A). MostRecentTransactionDate is nil (JSON
// null) when the account has no transactions.
type Summary struct {
	TotalDeposits             decimal.Decimal `json:"totalDeposits"`
	TotalWithdrawals          decimal.Decimal `json:"totalWithdrawals"`
	TransactionCount          int             `json:"transactionCount"`
	MostRecentTransactionDate *time.Time      `json:"mostRecentTransactionDate"`
}

// AccountService derives account-level views from the stored transactions.
type AccountService struct {
	store *store.TransactionStore
}

func NewAccountService(s *store.TransactionStore) *AccountService {
	return &AccountService{store: s}
}

// BalanceOf sums completed transactions for the account:
//   - deposit    increases toAccount
//   - withdrawal decreases fromAccount
//   - transfer   decreases fromAccount and increases toAccount
func (a *AccountService) BalanceOf(accountID string) decimal.Decimal {
	balance := decimal.Zero
	for _, t := range a.store.FindAll() {
		if t.Status != model.Completed {
			continue
		}
		switch t.Type {
		case model.Deposit:
			if t.ToAccount == accountID {
				balance = balance.Add(t.Amount)
			}
		case model.Withdrawal:
			if t.FromAccount == accountID {
				balance = balance.Sub(t.Amount)
			}
		case model.Transfer:
			if t.FromAccount == accountID {
				balance = balance.Sub(t.Amount)
			}
			if t.ToAccount == accountID {
				balance = balance.Add(t.Amount)
			}
		}
	}
	return balance
}

// SummaryOf aggregates activity for an account: total completed deposits and withdrawals,
// the number of transactions involving the account, and the most recent transaction date.
func (a *AccountService) SummaryOf(accountID string) Summary {
	deposits := decimal.Zero
	withdrawals := decimal.Zero
	count := 0
	var mostRecent *time.Time

	for _, t := range a.store.FindAll() {
		if t.FromAccount != accountID && t.ToAccount != accountID {
			continue
		}
		count++
		if mostRecent == nil || t.Timestamp.After(*mostRecent) {
			ts := t.Timestamp
			mostRecent = &ts
		}
		if t.Status == model.Completed {
			switch {
			case t.Type == model.Deposit && t.ToAccount == accountID:
				deposits = deposits.Add(t.Amount)
			case t.Type == model.Withdrawal && t.FromAccount == accountID:
				withdrawals = withdrawals.Add(t.Amount)
			}
		}
	}

	return Summary{
		TotalDeposits:             deposits,
		TotalWithdrawals:          withdrawals,
		TransactionCount:          count,
		MostRecentTransactionDate: mostRecent,
	}
}

// Interest computes simple interest on the current balance:
// interest = balance * rate * days / 365, rounded to 2 decimal places.
func (a *AccountService) Interest(accountID string, rate decimal.Decimal, days int) (Interest, error) {
	if rate.IsNegative() {
		return Interest{}, errors.New("rate must be zero or positive")
	}
	if days <= 0 {
		return Interest{}, errors.New("days must be a positive integer")
	}

	balance := a.BalanceOf(accountID)
	interest := balance.
		Mul(rate).
		Mul(decimal.NewFromInt(int64(days))).
		Div(daysInYear).
		Round(2)

	return Interest{
		AccountID: accountID,
		Balance:   balance,
		Rate:      rate,
		Days:      days,
		Interest:  interest,
	}, nil
}
