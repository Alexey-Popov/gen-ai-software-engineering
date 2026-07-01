package httpapi

import "net/http"

// handleHealth is a simple liveness endpoint (mirrors the Java Actuator path so the same
// frontend health check works against the Go backend).
func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "UP"})
}

// handleOpenAPI serves the OpenAPI 3 spec (hand-written, dependency-free).
func handleOpenAPI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(openAPISpec))
}

// handleDocs serves a Scalar API reference page that renders the spec above.
func handleDocs(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(scalarHTML))
}

const scalarHTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Banking API (Go) — Reference</title>
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json" data-configuration='{"theme":"purple","layout":"modern"}'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

const openAPISpec = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Banking Transactions API (Go)",
    "version": "v1",
    "description": "REST API for banking transactions — Homework 1, Go + Chi implementation. Same contract as the Java version."
  },
  "servers": [{ "url": "http://localhost:3000" }],
  "paths": {
    "/transactions": {
      "get": {
        "summary": "List transactions (with optional filters)",
        "parameters": [
          { "name": "accountId", "in": "query", "schema": { "type": "string" } },
          { "name": "type", "in": "query", "schema": { "type": "string", "enum": ["deposit", "withdrawal", "transfer"] } },
          { "name": "from", "in": "query", "schema": { "type": "string", "format": "date" } },
          { "name": "to", "in": "query", "schema": { "type": "string", "format": "date" } }
        ],
        "responses": {
          "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Transaction" } } } } }
        }
      },
      "post": {
        "summary": "Create a transaction",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/TransactionRequest" } } } },
        "responses": {
          "201": { "description": "Created", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Transaction" } } } },
          "400": { "description": "Validation failed" }
        }
      }
    },
    "/transactions/{id}": {
      "get": {
        "summary": "Get a transaction by id",
        "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
        "responses": { "200": { "description": "OK" }, "404": { "description": "Not found" } }
      }
    },
    "/transactions/export": {
      "get": {
        "summary": "Export transactions as CSV",
        "parameters": [{ "name": "format", "in": "query", "schema": { "type": "string", "enum": ["csv"] } }],
        "responses": { "200": { "description": "CSV file", "content": { "text/csv": {} } } }
      }
    },
    "/accounts/{accountId}/balance": {
      "get": {
        "summary": "Account balance",
        "parameters": [{ "name": "accountId", "in": "path", "required": true, "schema": { "type": "string" } }],
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/accounts/{accountId}/summary": {
      "get": {
        "summary": "Account summary (totals, count, most recent date)",
        "parameters": [{ "name": "accountId", "in": "path", "required": true, "schema": { "type": "string" } }],
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/accounts/{accountId}/interest": {
      "get": {
        "summary": "Simple interest = balance * rate * days / 365",
        "parameters": [
          { "name": "accountId", "in": "path", "required": true, "schema": { "type": "string" } },
          { "name": "rate", "in": "query", "required": true, "schema": { "type": "number" } },
          { "name": "days", "in": "query", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": { "200": { "description": "OK" }, "400": { "description": "Bad request" } }
      }
    },
    "/actuator/health": {
      "get": { "summary": "Health check", "responses": { "200": { "description": "UP" } } }
    }
  },
  "components": {
    "schemas": {
      "Transaction": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "fromAccount": { "type": "string", "example": "ACC-12345" },
          "toAccount": { "type": "string", "example": "ACC-67890" },
          "amount": { "type": "number", "example": 100.5 },
          "currency": { "type": "string", "example": "USD" },
          "type": { "type": "string", "enum": ["deposit", "withdrawal", "transfer"] },
          "timestamp": { "type": "string", "format": "date-time" },
          "status": { "type": "string", "enum": ["pending", "completed", "failed"] }
        }
      },
      "TransactionRequest": {
        "type": "object",
        "required": ["fromAccount", "toAccount", "amount", "currency", "type"],
        "properties": {
          "fromAccount": { "type": "string", "example": "ACC-12345" },
          "toAccount": { "type": "string", "example": "ACC-67890" },
          "amount": { "type": "number", "example": 100.5 },
          "currency": { "type": "string", "example": "USD" },
          "type": { "type": "string", "enum": ["deposit", "withdrawal", "transfer"] }
        }
      }
    }
  }
}`
