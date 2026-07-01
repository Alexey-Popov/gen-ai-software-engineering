package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
)

type errBody struct {
	Error   string `json:"error"`
	Details []struct {
		Field   string `json:"field"`
		Message string `json:"message"`
	} `json:"details"`
}

func bodyOf(from, to, amount, currency, typ string) string {
	return `{"fromAccount":"` + from + `","toAccount":"` + to + `","amount":` + amount +
		`,"currency":"` + currency + `","type":"` + typ + `"}`
}

func postBody(t *testing.T, body string) errBody {
	t.Helper()
	api := New()
	rec := doJSON(t, api.Router, http.MethodPost, "/transactions", body)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: want 400, got %d (%s)", rec.Code, rec.Body.String())
	}
	var parsed errBody
	if err := json.Unmarshal(rec.Body.Bytes(), &parsed); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if parsed.Error != "Validation failed" {
		t.Errorf("error: want 'Validation failed', got %q", parsed.Error)
	}
	return parsed
}

func TestCreate_negativeAmount_returns400(t *testing.T) {
	body := postBody(t, bodyOf("ACC-12345", "ACC-67890", "-5", "USD", "transfer"))
	if len(body.Details) != 1 || body.Details[0].Field != "amount" {
		t.Fatalf("details: %+v", body.Details)
	}
	if body.Details[0].Message != "Amount must be a positive number" {
		t.Errorf("message: %q", body.Details[0].Message)
	}
}

func TestCreate_amountMoreThanTwoDecimals_returns400(t *testing.T) {
	body := postBody(t, bodyOf("ACC-12345", "ACC-67890", "100.555", "USD", "transfer"))
	if len(body.Details) != 1 || body.Details[0].Field != "amount" {
		t.Fatalf("details: %+v", body.Details)
	}
}

func TestCreate_badAccountFormat_returns400(t *testing.T) {
	body := postBody(t, bodyOf("12345", "ACC-67890", "100.00", "USD", "transfer"))
	if len(body.Details) != 1 || body.Details[0].Field != "fromAccount" {
		t.Fatalf("details: %+v", body.Details)
	}
}

func TestCreate_invalidCurrency_returns400(t *testing.T) {
	body := postBody(t, bodyOf("ACC-12345", "ACC-67890", "100.00", "XYZ", "transfer"))
	if len(body.Details) != 1 || body.Details[0].Field != "currency" {
		t.Fatalf("details: %+v", body.Details)
	}
	if body.Details[0].Message != "Invalid currency code" {
		t.Errorf("message: %q", body.Details[0].Message)
	}
}

func TestCreate_invalidType_returns400(t *testing.T) {
	body := postBody(t, bodyOf("ACC-12345", "ACC-67890", "100.00", "USD", "gift"))
	if len(body.Details) != 1 || body.Details[0].Field != "type" {
		t.Fatalf("details: %+v", body.Details)
	}
}

func TestCreate_multipleErrors_returnsAllDetails(t *testing.T) {
	body := postBody(t, bodyOf("ACC-12345", "ACC-67890", "-5", "XYZ", "transfer"))
	if len(body.Details) != 2 {
		t.Fatalf("want 2 details, got %+v", body.Details)
	}
	seen := map[string]bool{}
	for _, d := range body.Details {
		seen[d.Field] = true
	}
	if !seen["amount"] || !seen["currency"] {
		t.Errorf("want amount+currency, got %+v", body.Details)
	}
}
