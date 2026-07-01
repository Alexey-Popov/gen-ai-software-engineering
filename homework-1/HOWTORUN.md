# How to Run

## Prerequisites

- Node.js 18 or later
- npm

## Installation

```bash
npm install
```

## Running the Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## Running Tests

Run all tests once:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Building for Production

```bash
npm run build
npm start
```

## Example Requests

### Create a transaction

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccount": "ACC-12345",
    "toAccount": "ACC-67890",
    "amount": 100.50,
    "currency": "USD",
    "type": "transfer"
  }'
```

### List all transactions

```bash
curl http://localhost:3000/api/transactions
```

### Filter transactions by account

```bash
curl "http://localhost:3000/api/transactions?accountId=ACC-12345"
```

### Get a transaction by ID

```bash
curl http://localhost:3000/api/transactions/<transaction-id>
```

### Get account balance

```bash
curl http://localhost:3000/api/accounts/ACC-12345/balance
```

### Get account summary

```bash
curl http://localhost:3000/api/accounts/ACC-12345/summary
```

### Calculate simple interest

```bash
curl "http://localhost:3000/api/accounts/ACC-12345/interest?rate=0.05&days=30"
```

### Export transactions as CSV

```bash
curl "http://localhost:3000/api/transactions/export?format=csv"
```

## Notes

- The application uses in-memory storage. All data is lost when the server restarts.
- Rate limiting is set to 100 requests per minute per IP address.
