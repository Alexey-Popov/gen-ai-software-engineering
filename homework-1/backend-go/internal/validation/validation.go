package validation

import (
	"regexp"

	"bankingapi/internal/model"
)

var accountRe = regexp.MustCompile(`^ACC-[A-Za-z0-9]+$`)

// iso4217 is a set of accepted uppercase ISO 4217 currency codes (major world currencies).
// Kept dependency-free on purpose; extend as needed.
var iso4217 = map[string]bool{
	"USD": true, "EUR": true, "GBP": true, "JPY": true, "CHF": true, "CAD": true,
	"AUD": true, "NZD": true, "CNY": true, "HKD": true, "SGD": true, "SEK": true,
	"NOK": true, "DKK": true, "PLN": true, "CZK": true, "HUF": true, "RON": true,
	"BGN": true, "TRY": true, "UAH": true, "INR": true, "BRL": true, "MXN": true,
	"ZAR": true, "KRW": true, "AED": true, "SAR": true, "ILS": true, "THB": true,
}

// FieldError is one per-field validation problem, serialized as {field, message}.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidateTransaction checks a create request and returns one FieldError per broken rule,
// in field order (so a single bad field yields exactly one entry).
func ValidateTransaction(req model.TransactionRequest) []FieldError {
	var errs []FieldError

	errs = validateAccount(errs, "fromAccount", req.FromAccount)
	errs = validateAccount(errs, "toAccount", req.ToAccount)

	switch {
	case !req.Amount.IsPositive():
		errs = append(errs, FieldError{"amount", "Amount must be a positive number"})
	case !req.Amount.Equal(req.Amount.Truncate(2)):
		errs = append(errs, FieldError{"amount", "Amount must have at most 2 decimal places"})
	}

	if req.Currency == "" {
		errs = append(errs, FieldError{"currency", "Currency is required"})
	} else if !iso4217[req.Currency] {
		errs = append(errs, FieldError{"currency", "Invalid currency code"})
	}

	switch req.Type {
	case "":
		errs = append(errs, FieldError{"type", "Type is required"})
	case "deposit", "withdrawal", "transfer":
		// valid
	default:
		errs = append(errs, FieldError{"type", "Type must be one of: deposit, withdrawal, transfer"})
	}

	return errs
}

func validateAccount(errs []FieldError, field, value string) []FieldError {
	if value == "" {
		return append(errs, FieldError{field, field + " is required"})
	}
	if !accountRe.MatchString(value) {
		return append(errs, FieldError{field, "Account number must match the format ACC-XXXXX"})
	}
	return errs
}
