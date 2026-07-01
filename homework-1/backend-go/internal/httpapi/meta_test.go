package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestHealth_returnsUp(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/actuator/health", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["status"] != "UP" {
		t.Errorf("status: got %v", body["status"])
	}
}

func TestOpenAPISpec_isValidJSONWithTitle(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/openapi.json", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	var spec map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &spec); err != nil {
		t.Fatalf("spec is not valid JSON: %v", err)
	}
	if spec["openapi"] == nil {
		t.Error("missing openapi version")
	}
	info, _ := spec["info"].(map[string]any)
	if info == nil || info["title"] != "Banking Transactions API (Go)" {
		t.Errorf("info.title: got %v", info["title"])
	}
}

func TestDocs_servesScalarPage(t *testing.T) {
	api := New()
	rec := doJSON(t, api.Router, http.MethodGet, "/docs", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/html") {
		t.Errorf("Content-Type: got %q", ct)
	}
	if !strings.Contains(rec.Body.String(), "api-reference") {
		t.Error("docs page should embed the Scalar api-reference script")
	}
}
