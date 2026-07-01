package httpapi

import (
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"
)

type hitWindow struct {
	start time.Time
	count int
}

// rateLimiter is an in-memory, per-key fixed-window limiter (Task 4D).
type rateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string]*hitWindow
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, hits: make(map[string]*hitWindow)}
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	h := rl.hits[key]
	if h == nil || now.Sub(h.start) >= rl.window {
		rl.hits[key] = &hitWindow{start: now, count: 1}
		return true
	}
	h.count++
	return h.count <= rl.limit
}

// rateLimitMiddleware limits each client IP to `limit` requests per `window`.
func rateLimitMiddleware(limit int, window time.Duration) func(http.Handler) http.Handler {
	rl := newRateLimiter(limit, window)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !rl.allow(clientIP(r)) {
				writeJSON(w, http.StatusTooManyRequests, map[string]any{
					"error":   "Too Many Requests",
					"message": fmt.Sprintf("Rate limit of %d requests per minute exceeded", limit),
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}
