import { NextRequest, NextResponse } from "next/server";
import { getAll } from "@/lib/store";
import { validateAccountId } from "@/lib/validator";
import { TransactionType, SummaryResponse } from "@/lib/types";
import { buildErrorResponse } from "@/lib/errors";

/**
 * GET /api/accounts/:accountId/summary
 * Returns a summary of transactions for a given account:
 * - totalDeposits: sum of amounts where type is DEPOSIT and toAccount matches
 * - totalWithdrawals: sum of amounts where type is WITHDRAWAL and fromAccount matches
 * - transactionCount: total number of transactions involving this account
 * - mostRecentTransactionDate: latest timestamp among matching transactions, or null if none
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    if (!validateAccountId(accountId)) {
      return NextResponse.json(
        buildErrorResponse("Invalid account ID format"),
        { status: 400 }
      );
    }

    const transactions = getAll();
    const accountTransactions = transactions.filter(
      (t) => t.fromAccount === accountId || t.toAccount === accountId
    );

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let mostRecentTransactionDate: string | null = null;

    for (const t of accountTransactions) {
      if (t.type === TransactionType.DEPOSIT && t.toAccount === accountId) {
        totalDeposits += t.amount;
      }
      if (t.type === TransactionType.WITHDRAWAL && t.fromAccount === accountId) {
        totalWithdrawals += t.amount;
      }

      if (
        mostRecentTransactionDate === null ||
        new Date(t.timestamp).getTime() > new Date(mostRecentTransactionDate).getTime()
      ) {
        mostRecentTransactionDate = t.timestamp;
      }
    }

    const response: SummaryResponse = {
      accountId,
      totalDeposits,
      totalWithdrawals,
      transactionCount: accountTransactions.length,
      mostRecentTransactionDate,
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      buildErrorResponse("Internal server error"),
      { status: 500 }
    );
  }
}
