package service

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"bankingapi/internal/model"
	"bankingapi/internal/store"
)

func tx(id, from, to, amount string, typ model.TransactionType, status model.TransactionStatus) model.Transaction {
	return model.Transaction{
		ID:          id,
		FromAccount: from,
		ToAccount:   to,
		Amount:      decimal.RequireFromString(amount),
		Currency:    "USD",
		Type:        typ,
		Timestamp:   time.Now().UTC(),
		Status:      status,
	}
}

func TestBalance_depositIncreasesToAccount(t *testing.T) {
	st := store.New()
	st.Save(tx("1", "ACC-000", "ACC-1", "100.00", model.Deposit, model.Completed))
	got := NewAccountService(st).BalanceOf("ACC-1")
	if !got.Equal(decimal.RequireFromString("100.00")) {
		t.Fatalf("want 100.00, got %s", got)
	}
}

func TestBalance_withdrawalDecreasesFromAccount(t *testing.T) {
	st := store.New()
	st.Save(tx("1", "ACC-1", "ACC-000", "40.00", model.Withdrawal, model.Completed))
	got := NewAccountService(st).BalanceOf("ACC-1")
	if !got.Equal(decimal.RequireFromString("-40.00")) {
		t.Fatalf("want -40.00, got %s", got)
	}
}

func TestBalance_transferMovesAmount(t *testing.T) {
	st := store.New()
	st.Save(tx("1", "ACC-1", "ACC-2", "30.00", model.Transfer, model.Completed))
	a := NewAccountService(st)
	if !a.BalanceOf("ACC-1").Equal(decimal.RequireFromString("-30.00")) {
		t.Errorf("ACC-1: got %s", a.BalanceOf("ACC-1"))
	}
	if !a.BalanceOf("ACC-2").Equal(decimal.RequireFromString("30.00")) {
		t.Errorf("ACC-2: got %s", a.BalanceOf("ACC-2"))
	}
}

func TestBalance_onlyCompletedCount(t *testing.T) {
	st := store.New()
	st.Save(tx("1", "ACC-000", "ACC-1", "100.00", model.Deposit, model.Completed))
	st.Save(tx("2", "ACC-000", "ACC-1", "999.00", model.Deposit, model.Pending))
	st.Save(tx("3", "ACC-000", "ACC-1", "999.00", model.Deposit, model.Failed))
	got := NewAccountService(st).BalanceOf("ACC-1")
	if !got.Equal(decimal.RequireFromString("100.00")) {
		t.Fatalf("want 100.00, got %s", got)
	}
}

func TestBalance_unknownAccountIsZero(t *testing.T) {
	got := NewAccountService(store.New()).BalanceOf("ACC-NONE")
	if !got.Equal(decimal.Zero) {
		t.Fatalf("want 0, got %s", got)
	}
}

func txAt(id, from, to, amount string, typ model.TransactionType, iso string) model.Transaction {
	ts, _ := time.Parse(time.RFC3339, iso)
	return model.Transaction{
		ID:          id,
		FromAccount: from,
		ToAccount:   to,
		Amount:      decimal.RequireFromString(amount),
		Currency:    "USD",
		Type:        typ,
		Timestamp:   ts,
		Status:      model.Completed,
	}
}

func TestSummary_returnsTotalsCountAndMostRecent(t *testing.T) {
	st := store.New()
	st.Save(txAt("1", "ACC-000", "ACC-1", "200.00", model.Deposit, "2024-01-01T10:00:00Z"))
	st.Save(txAt("2", "ACC-000", "ACC-1", "50.00", model.Deposit, "2024-01-02T10:00:00Z"))
	st.Save(txAt("3", "ACC-1", "ACC-000", "30.00", model.Withdrawal, "2024-01-03T10:00:00Z"))
	st.Save(txAt("4", "ACC-1", "ACC-2", "10.00", model.Transfer, "2024-01-04T10:00:00Z"))

	s := NewAccountService(st).SummaryOf("ACC-1")

	if !s.TotalDeposits.Equal(decimal.RequireFromString("250.00")) {
		t.Errorf("deposits: got %s", s.TotalDeposits)
	}
	if !s.TotalWithdrawals.Equal(decimal.RequireFromString("30.00")) {
		t.Errorf("withdrawals: got %s", s.TotalWithdrawals)
	}
	if s.TransactionCount != 4 {
		t.Errorf("count: got %d", s.TransactionCount)
	}
	want, _ := time.Parse(time.RFC3339, "2024-01-04T10:00:00Z")
	if s.MostRecentTransactionDate == nil || !s.MostRecentTransactionDate.Equal(want) {
		t.Errorf("mostRecent: got %v", s.MostRecentTransactionDate)
	}
}

func TestSummary_emptyAccount_zerosAndNilDate(t *testing.T) {
	s := NewAccountService(store.New()).SummaryOf("ACC-NONE")
	if !s.TotalDeposits.Equal(decimal.Zero) || !s.TotalWithdrawals.Equal(decimal.Zero) {
		t.Errorf("totals should be zero: %+v", s)
	}
	if s.TransactionCount != 0 {
		t.Errorf("count: got %d", s.TransactionCount)
	}
	if s.MostRecentTransactionDate != nil {
		t.Errorf("date should be nil, got %v", s.MostRecentTransactionDate)
	}
}

func TestInterest_isBalanceTimesRateTimesDaysOver365(t *testing.T) {
	st := store.New()
	st.Save(txAt("1", "ACC-000", "ACC-1", "1000.00", model.Deposit, "2024-01-01T10:00:00Z"))
	a := NewAccountService(st)

	full, err := a.Interest("ACC-1", decimal.RequireFromString("0.05"), 365)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !full.Balance.Equal(decimal.RequireFromString("1000.00")) {
		t.Errorf("balance: got %s", full.Balance)
	}
	if !full.Interest.Equal(decimal.RequireFromString("50.00")) {
		t.Errorf("interest (365d): want 50.00, got %s", full.Interest)
	}

	// 1000 * 0.05 * 30 / 365 = 4.1095... -> 4.11
	thirty, _ := a.Interest("ACC-1", decimal.RequireFromString("0.05"), 30)
	if !thirty.Interest.Equal(decimal.RequireFromString("4.11")) {
		t.Errorf("interest (30d): want 4.11, got %s", thirty.Interest)
	}
}

func TestInterest_zeroBalance_returnsZero(t *testing.T) {
	r, err := NewAccountService(store.New()).Interest("ACC-EMPTY", decimal.RequireFromString("0.05"), 365)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !r.Interest.Equal(decimal.Zero) {
		t.Errorf("interest: want 0, got %s", r.Interest)
	}
}

func TestInterest_invalidParams_returnError(t *testing.T) {
	a := NewAccountService(store.New())
	if _, err := a.Interest("X", decimal.RequireFromString("-0.01"), 30); err == nil {
		t.Error("negative rate should error")
	}
	if _, err := a.Interest("X", decimal.RequireFromString("0.05"), 0); err == nil {
		t.Error("non-positive days should error")
	}
}
