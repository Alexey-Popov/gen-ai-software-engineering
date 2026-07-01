package validation

import (
	"testing"

	"github.com/shopspring/decimal"

	"bankingapi/internal/model"
)

func req(from, to, amount, currency, typ string) model.TransactionRequest {
	return model.TransactionRequest{
		FromAccount: from,
		ToAccount:   to,
		Amount:      decimal.RequireFromString(amount),
		Currency:    currency,
		Type:        typ,
	}
}

func fields(errs []FieldError) map[string]string {
	m := make(map[string]string, len(errs))
	for _, e := range errs {
		m[e.Field] = e.Message
	}
	return m
}

func TestValidate_valid_hasNoErrors(t *testing.T) {
	if errs := ValidateTransaction(req("ACC-12345", "ACC-67890", "100.50", "USD", "transfer")); len(errs) != 0 {
		t.Fatalf("expected no errors, got %+v", errs)
	}
}

func TestValidate_negativeAmount(t *testing.T) {
	f := fields(ValidateTransaction(req("ACC-12345", "ACC-67890", "-5", "USD", "transfer")))
	if _, ok := f["amount"]; !ok {
		t.Errorf("expected amount error, got %+v", f)
	}
}

func TestValidate_tooManyDecimals(t *testing.T) {
	f := fields(ValidateTransaction(req("ACC-12345", "ACC-67890", "100.555", "USD", "transfer")))
	if f["amount"] != "Amount must have at most 2 decimal places" {
		t.Errorf("amount msg: %q", f["amount"])
	}
}

func TestValidate_badAccountFormat(t *testing.T) {
	f := fields(ValidateTransaction(req("12345", "ACC-67890", "1.00", "USD", "transfer")))
	if _, ok := f["fromAccount"]; !ok {
		t.Errorf("expected fromAccount error, got %+v", f)
	}
}

func TestValidate_invalidCurrency(t *testing.T) {
	unknown := fields(ValidateTransaction(req("ACC-12345", "ACC-67890", "1.00", "XYZ", "transfer")))
	lower := fields(ValidateTransaction(req("ACC-12345", "ACC-67890", "1.00", "usd", "transfer")))
	if unknown["currency"] != "Invalid currency code" {
		t.Errorf("unknown currency: %q", unknown["currency"])
	}
	if _, ok := lower["currency"]; !ok {
		t.Errorf("lowercase currency should be invalid, got %+v", lower)
	}
}

func TestValidate_invalidType(t *testing.T) {
	f := fields(ValidateTransaction(req("ACC-12345", "ACC-67890", "1.00", "USD", "gift")))
	if _, ok := f["type"]; !ok {
		t.Errorf("expected type error, got %+v", f)
	}
}
