package store

import (
	"sync"

	"bankingapi/internal/model"
)

// TransactionStore is an in-memory, thread-safe store (no database).
type TransactionStore struct {
	mu    sync.RWMutex
	items map[string]model.Transaction
}

func New() *TransactionStore {
	return &TransactionStore{items: make(map[string]model.Transaction)}
}

func (s *TransactionStore) Save(t model.Transaction) model.Transaction {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[t.ID] = t
	return t
}

func (s *TransactionStore) FindAll() []model.Transaction {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]model.Transaction, 0, len(s.items))
	for _, t := range s.items {
		out = append(out, t)
	}
	return out
}

func (s *TransactionStore) FindByID(id string) (model.Transaction, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.items[id]
	return t, ok
}

// Clear removes all transactions (used to isolate tests).
func (s *TransactionStore) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items = make(map[string]model.Transaction)
}
