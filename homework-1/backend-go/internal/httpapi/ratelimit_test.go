package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

func TestRateLimit_withinLimit_succeeds(t *testing.T) {
	api := newAPI(3, time.Minute)
	for i := 0; i < 3; i++ {
		rec := doJSON(t, api.Router, http.MethodGet, "/transactions", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: want 200, got %d", i+1, rec.Code)
		}
	}
}

func TestRateLimit_overLimit_returns429(t *testing.T) {
	api := newAPI(3, time.Minute)
	for i := 0; i < 3; i++ {
		if rec := doJSON(t, api.Router, http.MethodGet, "/transactions", ""); rec.Code != http.StatusOK {
			t.Fatalf("request %d should be 200, got %d", i+1, rec.Code)
		}
	}

	rec := doJSON(t, api.Router, http.MethodGet, "/transactions", "")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("4th request: want 429, got %d", rec.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["error"] != "Too Many Requests" {
		t.Errorf("error: got %v", body["error"])
	}
}
