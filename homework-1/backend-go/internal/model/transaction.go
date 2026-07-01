package model

import (
	"time"

	"github.com/shopspring/decimal"
)

func init() {
	// Serialize monetary amounts as JSON numbers (e.g. 100.50), not quoted strings,
	// matching the API contract and the Angular client.
	decimal.MarshalJSONWithoutQuotes = true
}

type TransactionType string

const (
	Deposit    TransactionType = "deposit"
	Withdrawal TransactionType = "withdrawal"
	Transfer   TransactionType = "transfer"
)

type TransactionStatus string

const (
	Pending   TransactionStatus = "pending"
	Completed TransactionStatus = "completed"
	Failed    TransactionStatus = "failed"
)

// Transaction is the stored/returned entity. Money is a decimal (never float).
type Transaction struct {
	ID          string            `json:"id"`
	FromAccount string            `json:"fromAccount"`
	ToAccount   string            `json:"toAccount"`
	Amount      decimal.Decimal   `json:"amount"`
	Currency    string            `json:"currency"`
	Type        TransactionType   `json:"type"`
	Timestamp   time.Time         `json:"timestamp"`
	Status      TransactionStatus `json:"status"`
}

// TransactionRequest is the incoming payload. Type stays a string so validation can
// produce structured, per-field errors (added in Cycle 2) instead of failing to decode.
type TransactionRequest struct {
	FromAccount string          `json:"fromAccount"`
	ToAccount   string          `json:"toAccount"`
	Amount      decimal.Decimal `json:"amount"`
	Currency    string          `json:"currency"`
	Type        string          `json:"type"`
}
