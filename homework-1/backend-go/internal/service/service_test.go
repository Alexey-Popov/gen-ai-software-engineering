package service

import (
	"testing"

	"github.com/shopspring/decimal"

	"bankingapi/internal/model"
	"bankingapi/internal/store"
)

func newService() *TransactionService {
	return NewTransactionService(store.New())
}

func TestCreate_assignsGeneratedFields(t *testing.T) {
	svc := newService()
	created := svc.Create(model.TransactionRequest{
		FromAccount: "ACC-12345",
		ToAccount:   "ACC-67890",
		Amount:      decimal.RequireFromString("100.50"),
		Currency:    "USD",
		Type:        "transfer",
	})

	if created.ID == "" {
		t.Error("id should not be empty")
	}
	if created.Timestamp.IsZero() {
		t.Error("timestamp should be set")
	}
	if created.Status != model.Completed {
		t.Errorf("status: want completed, got %s", created.Status)
	}
	if created.Type != model.Transfer {
		t.Errorf("type: want transfer, got %s", created.Type)
	}
}

func TestFindByID(t *testing.T) {
	svc := newService()
	created := svc.Create(model.TransactionRequest{
		FromAccount: "ACC-11111",
		ToAccount:   "ACC-22222",
		Amount:      decimal.RequireFromString("10.00"),
		Currency:    "EUR",
		Type:        "deposit",
	})

	got, ok := svc.FindByID(created.ID)
	if !ok {
		t.Fatal("expected to find the transaction")
	}
	if got.ID != created.ID {
		t.Errorf("id mismatch")
	}
	if _, ok := svc.FindByID("nope"); ok {
		t.Error("expected not found for unknown id")
	}
}
