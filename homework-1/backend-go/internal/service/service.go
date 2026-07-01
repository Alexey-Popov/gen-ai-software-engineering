package service

import (
	"crypto/rand"
	"fmt"
	"strings"
	"time"

	"bankingapi/internal/model"
	"bankingapi/internal/store"
)

// TransactionService holds the application logic for transactions.
type TransactionService struct {
	store *store.TransactionStore
}

func NewTransactionService(s *store.TransactionStore) *TransactionService {
	return &TransactionService{store: s}
}

// Create assigns the id, timestamp, and a completed status, then persists the transaction.
func (svc *TransactionService) Create(req model.TransactionRequest) model.Transaction {
	t := model.Transaction{
		ID:          newID(),
		FromAccount: req.FromAccount,
		ToAccount:   req.ToAccount,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Type:        model.TransactionType(strings.ToLower(strings.TrimSpace(req.Type))),
		Timestamp:   time.Now().UTC(),
		Status:      model.Completed,
	}
	return svc.store.Save(t)
}

func (svc *TransactionService) FindAll() []model.Transaction {
	return svc.store.FindAll()
}

// TransactionFilter holds optional, combinable filters (AND). Zero values are ignored.
// From is inclusive; ToExclusive is an exclusive upper bound (compute as to + 1 day).
type TransactionFilter struct {
	AccountID   string
	Type        string
	From        time.Time
	ToExclusive time.Time
}

// Find returns transactions matching all supplied filters. AccountID matches the from OR
// the to account. Any empty/zero filter is ignored.
func (svc *TransactionService) Find(f TransactionFilter) []model.Transaction {
	out := make([]model.Transaction, 0)
	for _, t := range svc.store.FindAll() {
		if f.AccountID != "" && t.FromAccount != f.AccountID && t.ToAccount != f.AccountID {
			continue
		}
		if f.Type != "" && string(t.Type) != f.Type {
			continue
		}
		if !f.From.IsZero() && t.Timestamp.Before(f.From) {
			continue
		}
		if !f.ToExclusive.IsZero() && !t.Timestamp.Before(f.ToExclusive) {
			continue
		}
		out = append(out, t)
	}
	return out
}

func (svc *TransactionService) FindByID(id string) (model.Transaction, bool) {
	return svc.store.FindByID(id)
}

// newID returns a random UUID-like identifier without extra dependencies.
func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
