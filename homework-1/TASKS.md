# 🏦 Homework 1: Build a Simple Banking Transactions API Using AI Assistance

## 📋 Overview

In this homework, you will create a minimal REST API for banking transactions using AI coding tools. This assignment focuses on getting hands-on experience with AI-assisted development and documenting how AI tools contributed to your work.

---

## 🎯 Learning Objectives

By completing this homework, you will:
- ✅ Gain practical experience using AI coding assistants
- ✅ Compare different AI tools' approaches to the same problem
- ✅ Learn to effectively prompt AI for code generation
- ✅ Practice documenting AI-assisted development workflows

---

### Technology Stack (Choose One)
- **Node.js** 
- **Python** 
- Other technolgies which you will comfortable with

---

## 📝 Tasks

### Task 1: Core API Implementation *(Required)* ⭐

Create a REST API with the following endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions` | Create a new transaction |
| `GET` | `/transactions` | List all transactions |
| `GET` | `/transactions/:id` | Get a specific transaction by ID |
| `GET` | `/accounts/:accountId/balance` | Get account balance |

**Transaction Model:**
```json
{
  "id": "string (auto-generated)",
  "fromAccount": "string",
  "toAccount": "string",
  "amount": "number",
  "currency": "string (ISO 4217: USD, EUR, GBP, etc.)",
  "type": "string (deposit | withdrawal | transfer)",
  "timestamp": "ISO 8601 datetime",
  "status": "string (pending | completed | failed)"
}
```

**Requirements:**
- Use in-memory storage (array or object) — no database required
- Validate that amounts are positive numbers
- Return appropriate HTTP status codes (200, 201, 400, 404)
- Include basic error handling

---

### Task 2: Transaction Validation *(Required)* ✅

Add validation logic for transactions:

- **Amount validation**: Must be positive, maximum 2 decimal places
- **Account validation**: Account numbers should follow format `ACC-XXXXX` (where X is alphanumeric)
- **Currency validation**: Only accept valid ISO 4217 currency codes (USD, EUR, GBP, JPY, etc.)
- Return meaningful error messages for invalid requests

**Example validation error response:**
```json
{
  "error": "Validation failed",
  "details": [
    {"field": "amount", "message": "Amount must be a positive number"},
    {"field": "currency", "message": "Invalid currency code"}
  ]
}
```

---

### Task 3: Basic Transaction History *(Required)* 📜

Implement transaction filtering on the `GET /transactions` endpoint:

- Filter by account: `?accountId=ACC-12345`
- Filter by type: `?type=transfer`
- Filter by date range: `?from=2024-01-01&to=2024-01-31`
- Combine multiple filters

---

### Task 4: Additional Features *(Choose at least 1)* 🌟

Implement **at least one** of the following additional features:

#### Option A: Transaction Summary Endpoint 📈
```
GET /accounts/:accountId/summary
```
Returns:
- Total deposits
- Total withdrawals
- Number of transactions
- Most recent transaction date

#### Option B: Simple Interest Calculation 💰
```
GET /accounts/:accountId/interest?rate=0.05&days=30
```
Calculate simple interest on current balance.

#### Option C: Transaction Export 📤
```
GET /transactions/export?format=csv
```
Export transactions as CSV format.

#### Option D: Rate Limiting 🚦
Implement basic rate limiting:
- Maximum 100 requests per minute per IP
- Return `429 Too Many Requests` when exceeded

---

## 📦 Deliverables

Your submission must include:

### 1️⃣ Source Code
- Complete working API implementation
- Organized folder structure
- `.gitignore` file excluding `node_modules/`, `.env`, etc.

### 2️⃣ Documentation

| File | Content |
|------|---------|
| `README.md` | Project overview, features implemented, architecture decisions |
| `HOWTORUN.md` | Step-by-step instructions to run the application |


### 3️⃣ Screenshots *(in `docs/screenshots/`)*
- 📸 Screenshots of AI tool interactions showing prompts and generated code
- 📸 Screenshot of your API running successfully
- 📸 Screenshot of sample API requests/responses (using Postman, curl, or similar)

### 4️⃣ Demo Files *(in `demo/`)*
- `run.sh` or `run.bat` — Script to start your application
- `sample-requests.http` or `sample-requests.sh` — Sample API calls for testing
- `sample-data.json` — Sample transaction data (if applicable)

---

## 🧪 Sample API Requests for Testing

```bash
# Create a transaction
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccount": "ACC-12345",
    "toAccount": "ACC-67890",
    "amount": 100.50,
    "currency": "USD",
    "type": "transfer"
  }'

# Get all transactions
curl http://localhost:3000/transactions

# Get transactions for specific account
curl "http://localhost:3000/transactions?accountId=ACC-12345"

# Get account balance
curl http://localhost:3000/accounts/ACC-12345/balance
```

---

---

## 💡 Tips for Success

| Tip | Description |
|-----|-------------|
| 🎯 **Start Simple** | Get the basic endpoints working first, then add features |
| 🔄 **Iterate with AI** | Don't expect perfect code on first prompt — refine your requests |
| 📝 **Save Your Prompts** | Keep a log of what prompts worked well for future reference |
| 🧪 **Test Thoroughly** | Use curl, Postman, or VS Code REST Client to test your API |
| 🔍 **Read AI Output** | Don't just copy-paste — understand what the AI generated |

---

## 📁 Example Project Structure

```
homework-1/
├── 📄 README.md
├── 📄 HOWTORUN.md
├── 📄 package.json (or requirements.txt / pom.xml)
├── 📄 .gitignore
├── 📂 src/
│   ├── index.js (or app.py / Application.java)
│   ├── 📂 routes/
│   │   └── transactions.js
│   ├── 📂 models/
│   │   └── transaction.js
│   ├── 📂 validators/
│   │   └── transactionValidator.js
│   └── 📂 utils/
│       └── helpers.js
├── 📂 docs/
│   └── 📂 screenshots/
│       ├── ai-prompt-1.png
│       ├── ai-prompt-2.png
│       └── api-running.png
└── 📂 demo/
    ├── run.sh
    ├── sample-requests.http
    └── sample-data.json
```

> **🌟 Tip:** Once your feature is ready, make sure to create a well-documented Pull Request (PR) summarizing your changes and linking to relevant issues. This ensures smooth code reviews and easy collaboration! 🚀


---

<div align="center">

### 🚀 Good luck and enjoy exploring AI-assisted development!

</div>
