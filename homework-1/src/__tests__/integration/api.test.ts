import { NextRequest } from "next/server";
import { reset as resetStore, create } from "@/lib/store";
import { reset as resetRateLimiter } from "@/lib/rate-limiter";
import { TransactionType, TransactionStatus } from "@/lib/types";

// Import route handlers
import { POST, GET as GETTransactions } from "@/app/api/transactions/route";
import { GET as GETTransactionById } from "@/app/api/transactions/[id]/route";
import { GET as GETExport } from "@/app/api/transactions/export/route";
import { GET as GETBalance } from "@/app/api/accounts/[accountId]/balance/route";
import { GET as GETSummary } from "@/app/api/accounts/[accountId]/summary/route";
import { GET as GETInterest } from "@/app/api/accounts/[accountId]/interest/route";

const BASE_URL = "http://localhost:3000";

beforeEach(() => {
  resetStore();
  resetRateLimiter();
});

describe("POST /api/transactions", () => {
  it("creates a valid transaction and returns 201", async () => {
    const body = {
      fromAccount: "ACC-11111",
      toAccount: "ACC-22222",
      amount: 100.5,
      currency: "USD",
      type: "deposit",
    };

    const request = new NextRequest(`${BASE_URL}/api/transactions`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.fromAccount).toBe("ACC-11111");
    expect(data.toAccount).toBe("ACC-22222");
    expect(data.amount).toBe(100.5);
    expect(data.currency).toBe("USD");
    expect(data.type).toBe("deposit");
    expect(data.status).toBe("pending");
    expect(data.timestamp).toBeDefined();
  });

  it("rejects invalid payload and returns 400 with validation errors", async () => {
    const body = {
      fromAccount: "INVALID",
      toAccount: "ACC-22222",
      amount: -10,
      currency: "USD",
      type: "deposit",
    };

    const request = new NextRequest(`${BASE_URL}/api/transactions`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Validation failed");
    expect(data.details).toBeDefined();
    expect(data.details.length).toBeGreaterThan(0);
  });

  it("rejects non-JSON body and returns 400", async () => {
    const request = new NextRequest(`${BASE_URL}/api/transactions`, {
      method: "POST",
      body: "not valid json {{",
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});

describe("GET /api/transactions", () => {
  it("returns all transactions with 200", async () => {
    create({
      fromAccount: "ACC-11111",
      toAccount: "ACC-22222",
      amount: 50,
      currency: "USD",
      type: TransactionType.DEPOSIT,
    });
    create({
      fromAccount: "ACC-33333",
      toAccount: "ACC-44444",
      amount: 75,
      currency: "EUR",
      type: TransactionType.WITHDRAWAL,
    });

    const request = new NextRequest(`${BASE_URL}/api/transactions`);
    const response = await GETTransactions(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });

  it("filters by accountId and returns 200", async () => {
    create({
      fromAccount: "ACC-11111",
      toAccount: "ACC-22222",
      amount: 50,
      currency: "USD",
      type: TransactionType.DEPOSIT,
    });
    create({
      fromAccount: "ACC-33333",
      toAccount: "ACC-44444",
      amount: 75,
      currency: "EUR",
      type: TransactionType.WITHDRAWAL,
    });

    const request = new NextRequest(
      `${BASE_URL}/api/transactions?accountId=ACC-11111`
    );
    const response = await GETTransactions(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].fromAccount).toBe("ACC-11111");
  });

  it("filters by type and returns 200", async () => {
    create({
      fromAccount: "ACC-11111",
      toAccount: "ACC-22222",
      amount: 50,
      currency: "USD",
      type: TransactionType.DEPOSIT,
    });
    create({
      fromAccount: "ACC-33333",
      toAccount: "ACC-44444",
      amount: 75,
      currency: "EUR",
      type: TransactionType.WITHDRAWAL,
    });

    const request = new NextRequest(
      `${BASE_URL}/api/transactions?type=deposit`
    );
    const response = await GETTransactions(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].type).toBe("deposit");
  });
});

describe("GET /api/transactions/:id", () => {
  it("returns a transaction for a valid ID with 200", async () => {
    const created = create({
      fromAccount: "ACC-11111",
      toAccount: "ACC-22222",
      amount: 100,
      currency: "USD",
      type: TransactionType.DEPOSIT,
    });

    const request = new NextRequest(
      `${BASE_URL}/api/transactions/${created.id}`
    );
    const response = await GETTransactionById(request, {
      params: Promise.resolve({ id: created.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(created.id);
    expect(data.amount).toBe(100);
  });

  it("returns 404 for a non-existent ID", async () => {
    const request = new NextRequest(
      `${BASE_URL}/api/transactions/non-existent-id`
    );
    const response = await GETTransactionById(request, {
      params: Promise.resolve({ id: "non-existent-id" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBeDefined();
  });
});

describe("GET /api/accounts/:accountId/balance", () => {
  it("returns 0 balance for a new account with 200", async () => {
    const request = new NextRequest(
      `${BASE_URL}/api/accounts/ACC-99999/balance`
    );
    const response = await GETBalance(request, {
      params: Promise.resolve({ accountId: "ACC-99999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accountId).toBe("ACC-99999");
    expect(data.balance).toBe(0);
  });

  it("returns correct balance for account with completed transactions", async () => {
    // Manually create a completed deposit transaction
    const { reset: resetStoreAgain, create: createTx, getAll } = await import(
      "@/lib/store"
    );
    // We need to directly manipulate store for completed transactions
    // Create a transaction and then modify its status to COMPLETED
    const tx = create({
      fromAccount: "ACC-11111",
      toAccount: "ACC-22222",
      amount: 200,
      currency: "USD",
      type: TransactionType.DEPOSIT,
    });
    // Access the internal transaction via getById and change status
    const { getById } = await import("@/lib/store");
    const stored = getById(tx.id);
    if (stored) {
      (stored as any).status = TransactionStatus.COMPLETED;
    }

    const request = new NextRequest(
      `${BASE_URL}/api/accounts/ACC-22222/balance`
    );
    const response = await GETBalance(request, {
      params: Promise.resolve({ accountId: "ACC-22222" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accountId).toBe("ACC-22222");
    expect(data.balance).toBe(200);
  });

  it("returns 400 for invalid account format", async () => {
    const request = new NextRequest(
      `${BASE_URL}/api/accounts/INVALID/balance`
    );
    const response = await GETBalance(request, {
      params: Promise.resolve({ accountId: "INVALID" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid account ID format");
  });
});

describe("GET /api/accounts/:accountId/summary", () => {
  it("returns zeros for account with no transactions", async () => {
    const request = new NextRequest(
      `${BASE_URL}/api/accounts/ACC-99999/summary`
    );
    const response = await GETSummary(request, {
      params: Promise.resolve({ accountId: "ACC-99999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accountId).toBe("ACC-99999");
    expect(data.totalDeposits).toBe(0);
    expect(data.totalWithdrawals).toBe(0);
    expect(data.transactionCount).toBe(0);
    expect(data.mostRecentTransactionDate).toBeNull();
  });

  it("returns correct summary for account with transactions", async () => {
    create({
      fromAccount: "ACC-11111",
      toAccount: "ACC-22222",
      amount: 150,
      currency: "USD",
      type: TransactionType.DEPOSIT,
    });
    create({
      fromAccount: "ACC-22222",
      toAccount: "ACC-33333",
      amount: 50,
      currency: "USD",
      type: TransactionType.WITHDRAWAL,
    });

    const request = new NextRequest(
      `${BASE_URL}/api/accounts/ACC-22222/summary`
    );
    const response = await GETSummary(request, {
      params: Promise.resolve({ accountId: "ACC-22222" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accountId).toBe("ACC-22222");
    expect(data.totalDeposits).toBe(150);
    expect(data.totalWithdrawals).toBe(50);
    expect(data.transactionCount).toBe(2);
    expect(data.mostRecentTransactionDate).toBeDefined();
  });
});

describe("GET /api/accounts/:accountId/interest", () => {
  it("returns correct interest calculation with 200", async () => {
    // Create a completed deposit so balance > 0
    const tx = create({
      fromAccount: "ACC-11111",
      toAccount: "ACC-22222",
      amount: 1000,
      currency: "USD",
      type: TransactionType.DEPOSIT,
    });
    const { getById } = await import("@/lib/store");
    const stored = getById(tx.id);
    if (stored) {
      (stored as any).status = TransactionStatus.COMPLETED;
    }

    const request = new NextRequest(
      `${BASE_URL}/api/accounts/ACC-22222/interest?rate=0.05&days=30`
    );
    const response = await GETInterest(request, {
      params: Promise.resolve({ accountId: "ACC-22222" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accountId).toBe("ACC-22222");
    expect(data.balance).toBe(1000);
    expect(data.rate).toBe(0.05);
    expect(data.days).toBe(30);
    // interest = 1000 * 0.05 * 30 / 365
    const expectedInterest = (1000 * 0.05 * 30) / 365;
    expect(data.interest).toBeCloseTo(expectedInterest, 10);
  });

  it("returns 400 for missing rate parameter", async () => {
    const request = new NextRequest(
      `${BASE_URL}/api/accounts/ACC-22222/interest?days=30`
    );
    const response = await GETInterest(request, {
      params: Promise.resolve({ accountId: "ACC-22222" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Rate must be a positive number");
  });

  it("returns 400 for missing days parameter", async () => {
    const request = new NextRequest(
      `${BASE_URL}/api/accounts/ACC-22222/interest?rate=0.05`
    );
    const response = await GETInterest(request, {
      params: Promise.resolve({ accountId: "ACC-22222" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Days must be a positive integer");
  });
});

describe("GET /api/transactions/export", () => {
  it("returns CSV with correct Content-Type with 200", async () => {
    create({
      fromAccount: "ACC-11111",
      toAccount: "ACC-22222",
      amount: 100,
      currency: "USD",
      type: TransactionType.DEPOSIT,
    });

    const request = new NextRequest(
      `${BASE_URL}/api/transactions/export?format=csv`
    );
    const response = await GETExport(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv");

    const body = await response.text();
    expect(body).toContain("id,fromAccount,toAccount,amount,currency,type,timestamp,status");
  });

  it("returns 400 for missing format parameter", async () => {
    const request = new NextRequest(
      `${BASE_URL}/api/transactions/export`
    );
    const response = await GETExport(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});
