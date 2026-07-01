package httpapi

import (
	"net/http"
	"strings"
	"testing"

	"bankingapi/internal/model"
)

func TestExportCsv_returns200_textCsv_withAttachment(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/transactions/export?format=csv", "")

	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/csv") {
		t.Errorf("Content-Type: got %q", ct)
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, "attachment") {
		t.Errorf("Content-Disposition: got %q", cd)
	}
}

func TestExportCsv_bodyHasHeaderAndOneLinePerTransaction(t *testing.T) {
	api := New()
	seedTx(api.Store, "a", "ACC-000", "ACC-1", model.Deposit, "2024-01-01T10:00:00Z")
	seedTx(api.Store, "b", "ACC-1", "ACC-2", model.Transfer, "2024-01-02T10:00:00Z")

	rec := doJSON(t, api.Router, http.MethodGet, "/transactions/export?format=csv", "")
	lines := strings.Split(strings.TrimSpace(rec.Body.String()), "\n")
	if len(lines) != 3 {
		t.Fatalf("want 3 lines (header + 2), got %d: %q", len(lines), rec.Body.String())
	}
	if strings.TrimSpace(lines[0]) != "id,fromAccount,toAccount,amount,currency,type,timestamp,status" {
		t.Errorf("header: got %q", lines[0])
	}
}

func TestExportCsv_unsupportedFormat_returns400(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/transactions/export?format=xml", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: want 400, got %d", rec.Code)
	}
}
