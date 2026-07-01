package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/shopspring/decimal"

	"bankingapi/internal/model"
)

const validBody = `{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":100.50,"currency":"USD","type":"transfer"}`

func doJSON(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body == "" {
		req = httptest.NewRequest(method, path, nil)
	} else {
		req = httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestCreateTransaction_validBody_returns201WithGeneratedFields(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodPost, "/transactions", validBody)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status: want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	var got model.Transaction
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.ID == "" {
		t.Error("id should not be empty")
	}
	if got.Timestamp.IsZero() {
		t.Error("timestamp should be set")
	}
	if got.Status != model.Completed {
		t.Errorf("status: want completed, got %s", got.Status)
	}
	if got.Type != model.Transfer {
		t.Errorf("type: want transfer, got %s", got.Type)
	}
	if !got.Amount.Equal(decimal.RequireFromString("100.50")) {
		t.Errorf("amount: want 100.50, got %s", got.Amount)
	}
	if got.FromAccount != "ACC-12345" {
		t.Errorf("fromAccount: got %s", got.FromAccount)
	}
}

func TestGetTransactionByID_unknown_returns404(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/transactions/does-not-exist", "")

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status: want 404, got %d", rec.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["error"] != "Transaction not found" {
		t.Errorf("error: got %v", body["error"])
	}
	if body["id"] != "does-not-exist" {
		t.Errorf("id: got %v", body["id"])
	}
}

func TestGetTransactionByID_existing_returns200(t *testing.T) {
	api := New()
	created := doJSON(t, api.Router, http.MethodPost, "/transactions", validBody)
	var tx model.Transaction
	_ = json.Unmarshal(created.Body.Bytes(), &tx)

	rec := doJSON(t, api.Router, http.MethodGet, "/transactions/"+tx.ID, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	var got model.Transaction
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if got.ID != tx.ID {
		t.Errorf("id mismatch: %s vs %s", got.ID, tx.ID)
	}
}

func TestListTransactions_afterCreate_returnsItem(t *testing.T) {
	api := New()
	doJSON(t, api.Router, http.MethodPost, "/transactions", validBody)

	rec := doJSON(t, api.Router, http.MethodGet, "/transactions", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	var list []model.Transaction
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list) != 1 {
		t.Fatalf("length: want 1, got %d", len(list))
	}
	if list[0].FromAccount != "ACC-12345" {
		t.Errorf("fromAccount: got %s", list[0].FromAccount)
	}
}
