package httpapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/shopspring/decimal"

	"bankingapi/internal/service"
)

type accountHandler struct {
	acct *service.AccountService
}

func (h *accountHandler) balance(w http.ResponseWriter, r *http.Request) {
	accountID := chi.URLParam(r, "accountId")
	writeJSON(w, http.StatusOK, map[string]any{
		"accountId": accountID,
		"balance":   h.acct.BalanceOf(accountID),
	})
}

func (h *accountHandler) summary(w http.ResponseWriter, r *http.Request) {
	accountID := chi.URLParam(r, "accountId")
	writeJSON(w, http.StatusOK, h.acct.SummaryOf(accountID))
}

func (h *accountHandler) interest(w http.ResponseWriter, r *http.Request) {
	accountID := chi.URLParam(r, "accountId")
	q := r.URL.Query()

	rateStr, daysStr := q.Get("rate"), q.Get("days")
	if rateStr == "" || daysStr == "" {
		badRequest(w, "rate and days are required")
		return
	}
	rate, err := decimal.NewFromString(rateStr)
	if err != nil {
		badRequest(w, "rate must be a number")
		return
	}
	days, err := strconv.Atoi(daysStr)
	if err != nil {
		badRequest(w, "days must be an integer")
		return
	}

	result, err := h.acct.Interest(accountID, rate, days)
	if err != nil {
		badRequest(w, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func badRequest(w http.ResponseWriter, message string) {
	writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Bad request", "message": message})
}
