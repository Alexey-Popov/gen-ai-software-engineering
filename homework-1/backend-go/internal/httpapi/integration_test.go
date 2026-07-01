package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/shopspring/decimal"

	"bankingapi/internal/model"
)

// Cycle 9 — end-to-end flow: create -> balance -> summary -> filters stay consistent.
func TestEndToEnd_create_balance_summary_consistent(t *testing.T) {
	api := New()

	doJSON(t, api.Router, http.MethodPost, "/transactions", bodyOf("ACC-000", "ACC-100", "500.00", "USD", "deposit"))
	doJSON(t, api.Router, http.MethodPost, "/transactions", bodyOf("ACC-100", "ACC-200", "200.00", "USD", "transfer"))

	// Balances
	assertBalance(t, api, "ACC-100", "300.00")
	assertBalance(t, api, "ACC-200", "200.00")

	// Summary for ACC-100: one deposit in, one transfer out (a transfer is not a withdrawal)
	var summary summaryBody
	rec := doJSON(t, api.Router, http.MethodGet, "/accounts/ACC-100/summary", "")
	_ = json.Unmarshal(rec.Body.Bytes(), &summary)
	if !summary.TotalDeposits.Equal(decimal.RequireFromString("500.00")) {
		t.Errorf("totalDeposits: got %s", summary.TotalDeposits)
	}
	if !summary.TotalWithdrawals.Equal(decimal.Zero) {
		t.Errorf("totalWithdrawals: want 0, got %s", summary.TotalWithdrawals)
	}
	if summary.TransactionCount != 2 {
		t.Errorf("transactionCount: got %d", summary.TransactionCount)
	}
	if summary.MostRecentTransactionDate == nil {
		t.Error("mostRecentTransactionDate should be set")
	}

	// Filters
	if n := countList(t, api, "?accountId=ACC-100"); n != 2 {
		t.Errorf("filter accountId: want 2, got %d", n)
	}
	if n := countList(t, api, "?type=transfer"); n != 1 {
		t.Errorf("filter type: want 1, got %d", n)
	}
	if n := countList(t, api, ""); n != 2 {
		t.Errorf("list all: want 2, got %d", n)
	}
}

func assertBalance(t *testing.T, api *API, accountID, want string) {
	t.Helper()
	rec := doJSON(t, api.Router, http.MethodGet, "/accounts/"+accountID+"/balance", "")
	var b balanceBody
	_ = json.Unmarshal(rec.Body.Bytes(), &b)
	if !b.Balance.Equal(decimal.RequireFromString(want)) {
		t.Errorf("balance %s: want %s, got %s", accountID, want, b.Balance)
	}
}

func countList(t *testing.T, api *API, query string) int {
	t.Helper()
	rec := doJSON(t, api.Router, http.MethodGet, "/transactions"+query, "")
	var list []model.Transaction
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	return len(list)
}
