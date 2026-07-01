package main

import (
	"log"
	"net/http"

	"bankingapi/internal/httpapi"
)

// Entry point for the Banking Transactions API (Go + Chi). Built test-first.
func main() {
	router := httpapi.NewRouter()
	addr := ":3000"
	log.Printf("Banking API listening on %s", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatal(err)
	}
}
