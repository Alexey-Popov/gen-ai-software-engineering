# 🏦 Homework 1: Banking Transactions API

> **Student Name**: Ruslan Formanchuk
> **Date Submitted**: 2026-04-23
> **AI Tools Used**: Claude Code (Anthropic)

---

## 📋 Project Overview

A fully functional REST API for managing banking transactions built with Node.js and Express. This project demonstrates AI-assisted development practices by implementing a complete banking system with transaction management, validation, filtering, and additional features like balance calculation, transaction summaries, interest calculation, and CSV export.

The API uses in-memory storage and provides comprehensive error handling, validation, and HTTP status codes following REST best practices.

---

## ✨ Features Implemented

### Core Features (Task 1-3)

✅ **Transaction Management**
- Create new transactions (POST /transactions)
- List all transactions (GET /transactions)
- Get transaction by ID (GET /transactions/:id)
- Calculate account balance (GET /accounts/:accountId/balance)

✅ **Comprehensive Validation**
- Amount validation (positive, max 2 decimals)
- Account format validation (ACC-XXXXX pattern)
- ISO 4217 currency code validation
- Transaction type validation
- Detailed error messages with field-level feedback

✅ **Advanced Filtering**
- Filter by account ID (checks both fromAccount and toAccount)
- Filter by transaction type (deposit, withdrawal, transfer)
- Filter by date range (ISO 8601 format)
- Combine multiple filters with AND logic

### Additional Features (Task 4)

✅ **Transaction Summary** (Option A)
- GET /accounts/:accountId/summary
- Returns total deposits, withdrawals, transaction count, and most recent transaction

✅ **Simple Interest Calculation** (Option B)
- GET /accounts/:accountId/interest?rate=0.05&days=30
- Calculates interest based on current balance using formula: Interest = Principal × Rate × (Days / 365)

✅ **CSV Export** (Option C)
- GET /transactions/export?format=csv
- Exports all transactions in CSV format with proper Content-Type headers

---

## 🏗️ Architecture & Technology Stack

### Technology Choices

**Backend Framework:** Node.js with Express.js
- Chosen for its simplicity, extensive ecosystem, and excellent AI tool support
- Lightweight and fast for REST API development
- Express provides robust routing and middleware support

**Key Dependencies:**
- `express` (v4.18.2) - Web framework for Node.js
- `uuid` (v9.0.0) - Generate unique transaction IDs
- `nodemon` (v3.0.1, dev) - Auto-restart server during development

### Project Structure

```
homework-1/
├── src/
│   ├── index.js                    # Main application entry point
│   ├── routes/
│   │   ├── transactions.js         # Transaction endpoints
│   │   └── accounts.js             # Account endpoints (balance, summary, interest)
│   ├── models/
│   │   └── transaction.js          # Transaction data model
│   ├── validators/
│   │   └── transactionValidator.js # Validation logic for all fields
│   ├── utils/
│   │   └── helpers.js              # Helper functions (balance, summary, interest, CSV)
│   └── storage/
│       └── inMemoryStorage.js      # In-memory data store with filtering
├── demo/
│   ├── run.sh                      # Quick start script
│   ├── sample-requests.http        # REST Client sample requests
│   └── sample-data.json            # Sample transaction data
├── docs/
│   └── screenshots/                # AI interaction and testing screenshots
├── package.json                    # Project dependencies
└── .gitignore                      # Excluded files
```

### Architecture Decisions

1. **Modular Structure**: Separated concerns into routes, models, validators, utils, and storage
2. **In-Memory Storage**: Simple singleton pattern for data storage (resets on restart)
3. **Validation Layer**: Centralized validation with detailed error responses
4. **Helper Functions**: Reusable utility functions for calculations
5. **Error Handling**: Consistent error responses across all endpoints
6. **RESTful Design**: Proper HTTP methods, status codes, and resource naming

---

## 🔌 API Endpoints

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions` | Create a new transaction |
| `GET` | `/transactions` | List all transactions (supports filtering) |
| `GET` | `/transactions/:id` | Get specific transaction by ID |
| `GET` | `/transactions/export?format=csv` | Export transactions as CSV |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/accounts/:accountId/balance` | Get account balance |
| `GET` | `/accounts/:accountId/summary` | Get transaction summary |
| `GET` | `/accounts/:accountId/interest` | Calculate simple interest (params: rate, days) |

### Query Parameters (GET /transactions)

- `accountId` - Filter by account (e.g., `?accountId=ACC-12345`)
- `type` - Filter by type (e.g., `?type=transfer`)
- `from` - Filter by start date (e.g., `?from=2024-01-01`)
- `to` - Filter by end date (e.g., `?to=2024-01-31`)

---

## 📊 Transaction Data Model

```json
{
  "id": "uuid-string",
  "fromAccount": "ACC-XXXXX",
  "toAccount": "ACC-XXXXX",
  "amount": 100.50,
  "currency": "USD",
  "type": "transfer",
  "timestamp": "2024-04-23T10:30:00.000Z",
  "status": "completed"
}
```

### Field Validations

- **fromAccount/toAccount**: Must match pattern `ACC-[A-Z0-9]{5}` (case-insensitive)
- **amount**: Positive number with maximum 2 decimal places
- **currency**: Valid ISO 4217 code (USD, EUR, GBP, JPY, etc.)
- **type**: One of: `deposit`, `withdrawal`, `transfer`
- **id**: Auto-generated UUID
- **timestamp**: Auto-generated ISO 8601 datetime
- **status**: Default: `completed`

---

## 🤖 AI Tools Usage

### Tools Used
- **Claude Code** (Anthropic) - Primary development assistant for:
  - Project structure design
  - Code generation for endpoints and validation
  - Helper function implementation
  - Error handling patterns
  - Documentation generation

### AI-Assisted Development Workflow

1. **Project Setup**
   - Prompt: "Create a Node.js Express project structure for a banking transactions API with modular organization"
   - AI generated: package.json, folder structure, .gitignore

2. **Core Implementation**
   - Prompt: "Implement POST /transactions endpoint with validation for account format ACC-XXXXX, positive amounts with 2 decimals, and ISO 4217 currencies"
   - AI generated: Transaction model, validator module, route handler

3. **Filtering Logic**
   - Prompt: "Add query parameter filtering for transactions by accountId (check both from/to), type, and date range"
   - AI generated: Filter methods in storage module

4. **Additional Features**
   - Prompt: "Implement balance calculation considering deposits, withdrawals, and transfers"
   - AI generated: Helper functions for balance, summary, and interest calculations

5. **Documentation**
   - Prompt: "Generate comprehensive README with API documentation and examples"
   - AI generated: API documentation, examples, and project structure docs

### What Worked Well
- AI excelled at generating boilerplate code and standard patterns
- Excellent at creating validation logic with edge cases
- Generated comprehensive error handling
- Produced clear, well-documented code with comments

### Challenges & Solutions
- **Challenge**: Initial validation regex needed adjustment for case-insensitivity
  - **Solution**: Added `.toLowerCase()`/`.toUpperCase()` conversions in validators

- **Challenge**: Balance calculation logic needed to handle all transaction types correctly
  - **Solution**: Refined prompt to specify exact logic for deposits, withdrawals, and transfers

- **Challenge**: CSV export needed proper Content-Type headers
  - **Solution**: Asked AI to add response headers for file download

---

## 🧪 Testing & Validation

### Test Coverage

✅ All core endpoints working
✅ Validation errors return proper 400 status with details
✅ Non-existent resources return 404
✅ Filtering works with single and combined parameters
✅ Balance calculation handles all transaction types
✅ CSV export generates proper format

### Sample Test Scenarios

1. **Create Transaction** - Returns 201 with transaction object
2. **Invalid Amount** - Returns 400 with validation error
3. **Invalid Account Format** - Returns 400 with validation error
4. **Filter by Account** - Returns filtered list
5. **Get Balance** - Returns calculated balance
6. **Get Summary** - Returns transaction statistics
7. **Calculate Interest** - Returns interest calculation
8. **Export CSV** - Downloads CSV file
9. **404 Error** - Non-existent transaction returns 404

See `demo/sample-requests.http` for ready-to-run API request examples.

---

## 🚀 How to Run

See [HOWTORUN.md](./HOWTORUN.md) for detailed instructions.

**Quick Start:**
```bash
cd homework-1
npm install
npm start
```

Server runs on `http://localhost:3000`

---

## 📸 Screenshots

Screenshots demonstrating AI interaction and working API tests are located in `docs/screenshots/`:
- 16 screenshots total (6 AI development + 10 API verification)
- AI prompts and generated code
- Server running successfully
- API request/response examples (POST, list, balance, interest, CSV)
- Validation error handling
- Additional features working

---

## 🎯 Homework Requirements Met

- ✅ Task 1: Core API Implementation (4 endpoints)
- ✅ Task 2: Transaction Validation (amount, account, currency)
- ✅ Task 3: Transaction Filtering (account, type, date range)
- ✅ Task 4: Additional Features (ALL options implemented)
  - ✅ Option A: Transaction Summary
  - ✅ Option B: Interest Calculation
  - ✅ Option C: CSV Export
- ✅ Documentation (README, HOWTORUN)
- ✅ Demo scripts and sample requests
- ✅ AI usage documentation

---

## 📚 Additional Resources

- [TASKS.md](./TASKS.md) - Original homework requirements
- [HOWTORUN.md](./HOWTORUN.md) - Detailed setup and run instructions
- [demo/sample-requests.http](./demo/sample-requests.http) - REST Client examples

---

## 🙏 Acknowledgments

This project was completed as part of the **GenAI and Agentic AI for Software Engineering** training course, demonstrating practical applications of AI-assisted development tools and methodologies.

---

<div align="center">

*Built with Claude Code and Express.js*

**⭐ All required features + bonus features implemented!**

</div>
