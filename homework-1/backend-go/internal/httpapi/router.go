package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"bankingapi/internal/service"
	"bankingapi/internal/store"
)

const (
	defaultRateLimit  = 100
	defaultRateWindow = time.Minute
)

// API bundles the router with its store and service so tests can seed or clear state.
type API struct {
	Router  *chi.Mux
	Store   *store.TransactionStore
	Service *service.TransactionService
	Account *service.AccountService
}

// New wires the store, services, and routes with the default rate limit (100/min per IP).
func New() *API {
	return newAPI(defaultRateLimit, defaultRateWindow)
}

// newAPI builds the API with a configurable rate limit (tests use a low limit).
func newAPI(rateLimit int, rateWindow time.Duration) *API {
	st := store.New()
	svc := service.NewTransactionService(st)
	acct := service.NewAccountService(st)

	a := &API{Store: st, Service: svc, Account: acct}

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(rateLimitMiddleware(rateLimit, rateWindow))

	th := &transactionHandler{svc: svc}
	r.Post("/transactions", th.create)
	r.Get("/transactions", th.list)
	r.Get("/transactions/export", th.export)
	r.Get("/transactions/{id}", th.getByID)

	ah := &accountHandler{acct: acct}
	r.Get("/accounts/{accountId}/balance", ah.balance)
	r.Get("/accounts/{accountId}/summary", ah.summary)
	r.Get("/accounts/{accountId}/interest", ah.interest)

	// Health & API reference
	r.Get("/actuator/health", handleHealth)
	r.Get("/openapi.json", handleOpenAPI)
	r.Get("/docs", handleDocs)

	a.Router = r
	return a
}

// NewRouter returns just the HTTP handler (convenience for main and simple tests).
func NewRouter() http.Handler {
	return New().Router
}
