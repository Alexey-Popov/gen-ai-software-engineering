package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"bankingapi/internal/model"
	"bankingapi/internal/store"
)

func seedTx(st *store.TransactionStore, id, from, to string, typ model.TransactionType, isoDate string) {
	ts, _ := time.Parse(time.RFC3339, isoDate)
	st.Save(model.Transaction{
		ID:          id,
		FromAccount: from,
		ToAccount:   to,
		Amount:      decimal.RequireFromString("10.00"),
		Currency:    "USD",
		Type:        typ,
		Timestamp:   ts,
		Status:      model.Completed,
	})
}

func seededAPI() *API {
	api := New()
	seedTx(api.Store, "t1", "ACC-A", "ACC-B", model.Transfer, "2024-01-10T12:00:00Z")
	seedTx(api.Store, "t2", "ACC-C", "ACC-A", model.Deposit, "2024-01-20T12:00:00Z")
	seedTx(api.Store, "t3", "ACC-A", "ACC-D", model.Withdrawal, "2024-02-15T12:00:00Z")
	seedTx(api.Store, "t4", "ACC-X", "ACC-Y", model.Transfer, "2024-01-25T12:00:00Z")
	return api
}

func listLen(t *testing.T, api *API, query string) int {
	t.Helper()
	rec := doJSON(t, api.Router, http.MethodGet, "/transactions"+query, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	var list []model.Transaction
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return len(list)
}

func TestFilter_byAccountId_matchesFromOrTo(t *testing.T) {
	if n := listLen(t, seededAPI(), "?accountId=ACC-A"); n != 3 {
		t.Fatalf("want 3 (t1,t2,t3), got %d", n)
	}
}

func TestFilter_byType(t *testing.T) {
	if n := listLen(t, seededAPI(), "?type=transfer"); n != 2 {
		t.Fatalf("want 2 (t1,t4), got %d", n)
	}
}

func TestFilter_byDateRange_inclusive(t *testing.T) {
	if n := listLen(t, seededAPI(), "?from=2024-01-10&to=2024-01-25"); n != 3 {
		t.Fatalf("want 3 (t1,t2,t4), got %d", n)
	}
}

func TestFilter_combined_appliesAsAnd(t *testing.T) {
	api := seededAPI()
	rec := doJSON(t, api.Router, http.MethodGet, "/transactions?accountId=ACC-A&type=transfer", "")
	var list []model.Transaction
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list) != 1 {
		t.Fatalf("want 1 (t1), got %d", len(list))
	}
	if list[0].FromAccount != "ACC-A" || list[0].ToAccount != "ACC-B" {
		t.Errorf("unexpected match: %+v", list[0])
	}
}

func TestFilter_noMatches_returnsEmpty(t *testing.T) {
	if n := listLen(t, seededAPI(), "?accountId=ACC-NONE"); n != 0 {
		t.Fatalf("want 0, got %d", n)
	}
}
