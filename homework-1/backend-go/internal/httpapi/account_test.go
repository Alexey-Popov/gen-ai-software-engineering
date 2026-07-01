package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/shopspring/decimal"
)

type balanceBody struct {
	AccountID string          `json:"accountId"`
	Balance   decimal.Decimal `json:"balance"`
}

func TestGetBalance_existingAccount_returnsComputedBalance(t *testing.T) {
	api := New()
	doJSON(t, api.Router, http.MethodPost, "/transactions", bodyOf("ACC-000", "ACC-12345", "200.00", "USD", "deposit"))
	doJSON(t, api.Router, http.MethodPost, "/transactions", bodyOf("ACC-12345", "ACC-000", "50.00", "USD", "withdrawal"))

	rec := doJSON(t, api.Router, http.MethodGet, "/accounts/ACC-12345/balance", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	var body balanceBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.AccountID != "ACC-12345" {
		t.Errorf("accountId: got %s", body.AccountID)
	}
	if !body.Balance.Equal(decimal.RequireFromString("150.00")) {
		t.Errorf("balance: want 150.00, got %s", body.Balance)
	}
}

func TestGetBalance_unknownAccount_returnsZero(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/accounts/ACC-99999/balance", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	var body balanceBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if !body.Balance.Equal(decimal.Zero) {
		t.Errorf("balance: want 0, got %s", body.Balance)
	}
}

type summaryBody struct {
	TotalDeposits             decimal.Decimal `json:"totalDeposits"`
	TotalWithdrawals          decimal.Decimal `json:"totalWithdrawals"`
	TransactionCount          int             `json:"transactionCount"`
	MostRecentTransactionDate *time.Time      `json:"mostRecentTransactionDate"`
}

func TestGetSummary_returnsAggregates(t *testing.T) {
	api := New()
	doJSON(t, api.Router, http.MethodPost, "/transactions", bodyOf("ACC-000", "ACC-12345", "200.00", "USD", "deposit"))
	doJSON(t, api.Router, http.MethodPost, "/transactions", bodyOf("ACC-000", "ACC-12345", "50.00", "USD", "deposit"))
	doJSON(t, api.Router, http.MethodPost, "/transactions", bodyOf("ACC-12345", "ACC-000", "30.00", "USD", "withdrawal"))

	rec := doJSON(t, api.Router, http.MethodGet, "/accounts/ACC-12345/summary", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	var body summaryBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if !body.TotalDeposits.Equal(decimal.RequireFromString("250.00")) {
		t.Errorf("totalDeposits: got %s", body.TotalDeposits)
	}
	if !body.TotalWithdrawals.Equal(decimal.RequireFromString("30.00")) {
		t.Errorf("totalWithdrawals: got %s", body.TotalWithdrawals)
	}
	if body.TransactionCount != 3 {
		t.Errorf("transactionCount: got %d", body.TransactionCount)
	}
	if body.MostRecentTransactionDate == nil {
		t.Error("mostRecentTransactionDate should be set")
	}
}

func TestGetSummary_emptyAccount_returnsZeros(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/accounts/ACC-99999/summary", "")
	var body summaryBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body.TransactionCount != 0 {
		t.Errorf("count: got %d", body.TransactionCount)
	}
	if body.MostRecentTransactionDate != nil {
		t.Errorf("date should be null, got %v", body.MostRecentTransactionDate)
	}
}

type interestBody struct {
	AccountID string          `json:"accountId"`
	Balance   decimal.Decimal `json:"balance"`
	Rate      decimal.Decimal `json:"rate"`
	Days      int             `json:"days"`
	Interest  decimal.Decimal `json:"interest"`
}

func TestGetInterest_returnsInputsAndResult(t *testing.T) {
	api := New()
	doJSON(t, api.Router, http.MethodPost, "/transactions", bodyOf("ACC-000", "ACC-12345", "1000.00", "USD", "deposit"))

	rec := doJSON(t, api.Router, http.MethodGet, "/accounts/ACC-12345/interest?rate=0.05&days=365", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	var body interestBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body.AccountID != "ACC-12345" {
		t.Errorf("accountId: got %s", body.AccountID)
	}
	if !body.Balance.Equal(decimal.RequireFromString("1000.00")) {
		t.Errorf("balance: got %s", body.Balance)
	}
	if !body.Rate.Equal(decimal.RequireFromString("0.05")) {
		t.Errorf("rate: got %s", body.Rate)
	}
	if body.Days != 365 {
		t.Errorf("days: got %d", body.Days)
	}
	if !body.Interest.Equal(decimal.RequireFromString("50.00")) {
		t.Errorf("interest: want 50.00, got %s", body.Interest)
	}
}

func TestGetInterest_missingParam_returns400(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/accounts/ACC-12345/interest?days=30", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: want 400, got %d", rec.Code)
	}
}

func TestGetInterest_nonPositiveDays_returns400(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/accounts/ACC-12345/interest?rate=0.05&days=-5", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: want 400, got %d", rec.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["error"] != "Bad request" {
		t.Errorf("error: got %v", body["error"])
	}
}
