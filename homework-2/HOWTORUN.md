# 🚀 How to Run: Customer Support System

## Quick Start

### Option 1: Using Demo Script (Recommended)
```bash
cd homework-2
./demo/run.sh
```

### Option 2: Manual Setup
```bash
cd homework-2
npm install
npm start
```

## Prerequisites

- **Node.js**: v14 or higher
- **npm**: v6 or higher

Check your versions:
```bash
node --version
npm --version
```

## Step-by-Step Instructions

### 1. Install Dependencies
```bash
npm install
```

This will install:
- express (API framework)
- uuid (ID generation)
- csv-parser (CSV file parsing)
- xml2js (XML file parsing)
- jest, supertest (testing)

### 2. Start the Server
```bash
npm start
```

Expected output:
```
✓ Customer Support System API running on http://localhost:3000
✓ Ready to handle ticket requests
```

### 3. Verify Server is Running
Open browser or use curl:
```bash
curl http://localhost:3000
```

Should return:
```json
{
  "message": "Customer Support System API",
  "version": "1.0.0",
  "endpoints": {
    "tickets": "/tickets",
    "health": "/"
  }
}
```

## Testing the API

### Quick Test: Test All Routes Automatically
```bash
./demo/test-all-routes.sh
```

This script will automatically test all 8 API endpoints:
- ✓ Health check
- ✓ Create ticket
- ✓ List tickets
- ✓ Get ticket by ID
- ✓ Update ticket
- ✓ Auto-classify ticket
- ✓ Import CSV
- ✓ Delete ticket
- ✓ Filtering

### Manual Testing Examples

#### Create a Ticket
```bash
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "test@example.com",
    "customer_name": "Test User",
    "subject": "Cannot login",
    "description": "I forgot my password and need help"
  }'
```

### Import CSV File
```bash
curl -X POST http://localhost:3000/tickets/import \
  -H "Content-Type: text/csv" \
  --data-binary @demo/sample_tickets.csv
```

### List All Tickets
```bash
curl http://localhost:3000/tickets
```

### Auto-Classify a Ticket
```bash
# Replace {ticket-id} with actual ID from create response
curl -X POST http://localhost:3000/tickets/{ticket-id}/auto-classify
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run with Coverage Report
```bash
npm run test:coverage
```

### Run Specific Test
```bash
npm test -- test_ticket_api
```

## Troubleshooting

### Port Already in Use
If port 3000 is busy:
```bash
PORT=3001 npm start
```

### Dependencies Installation Failed
Try:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Tests Failing
Make sure server is NOT running when executing tests:
```bash
# Stop server if running (Ctrl+C)
npm test
```

### Import Not Working
Check file format and Content-Type:
- CSV: `Content-Type: text/csv`
- JSON: `Content-Type: application/json`
- XML: `Content-Type: application/xml` or `text/xml`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Check code style |
| `npm run lint:fix` | Fix code style issues |
| `./demo/test-all-routes.sh` | Test all API endpoints automatically |

## Default Configuration

- **Port**: 3000
- **Host**: localhost
- **Storage**: In-memory (data resets on restart)
- **Log Level**: Info (shows all requests)

## Next Steps

1. ✅ Server running at http://localhost:3000
2. **Quick test all routes**: `./demo/test-all-routes.sh`
3. Import sample data: `demo/sample_tickets.csv`
4. Test endpoints using curl or Postman
5. Check API documentation in README.md
6. Run tests to verify everything works

## Support

For issues or questions:
- Check README.md for full documentation
- Review test files in `tests/` for examples
- See `demo/sample-requests.http` for request examples
