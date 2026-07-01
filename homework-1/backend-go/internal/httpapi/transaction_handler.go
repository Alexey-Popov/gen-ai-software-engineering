package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"bankingapi/internal/model"
	"bankingapi/internal/service"
	"bankingapi/internal/validation"
)

const dateLayout = "2006-01-02"

type transactionHandler struct {
	svc *service.TransactionService
}

func (h *transactionHandler) create(w http.ResponseWriter, r *http.Request) {
	var req model.TransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid request body"})
		return
	}
	if fieldErrors := validation.ValidateTransaction(req); len(fieldErrors) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error":   "Validation failed",
			"details": fieldErrors,
		})
		return
	}
	created := h.svc.Create(req)
	writeJSON(w, http.StatusCreated, created)
}

func (h *transactionHandler) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	filter := service.TransactionFilter{
		AccountID: q.Get("accountId"),
		Type:      q.Get("type"),
	}
	if s := q.Get("from"); s != "" {
		if d, err := time.Parse(dateLayout, s); err == nil {
			filter.From = d.UTC()
		}
	}
	if s := q.Get("to"); s != "" {
		if d, err := time.Parse(dateLayout, s); err == nil {
			filter.ToExclusive = d.AddDate(0, 0, 1).UTC() // inclusive of the whole "to" day
		}
	}
	writeJSON(w, http.StatusOK, h.svc.Find(filter))
}

func (h *transactionHandler) export(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}
	if format != "csv" {
		badRequest(w, "Unsupported export format: "+format)
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="transactions.csv"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(transactionsToCSV(h.svc.FindAll())))
}

func (h *transactionHandler) getByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	t, ok := h.svc.FindByID(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "Transaction not found", "id": id})
		return
	}
	writeJSON(w, http.StatusOK, t)
}
