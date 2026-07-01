package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Cycle 0 — GET /transactions returns 200 and an empty JSON array.
func TestListTransactions_whenEmpty_returns200AndEmptyArray(t *testing.T) {
	router := NewRouter()

	req := httptest.NewRequest(http.MethodGet, "/transactions", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: want %d, got %d", http.StatusOK, rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != "[]" {
		t.Fatalf("body: want %q, got %q", "[]", got)
	}
}
