import { NextRequest, NextResponse } from "next/server";
import { getAll } from "@/lib/store";
import { validateAccountId } from "@/lib/validator";
import { TransactionStatus, TransactionType, BalanceResponse } from "@/lib/types";
import { buildErrorResponse } from "@/lib/errors";

/**
 * GET /api/accounts/:accountId/balance
 * Calculates the balance for a given account based on completed transactions.
 * - Deposits where account is toAccount: ADD amount
 * - Transfers where account is toAccount (incoming): ADD amount
 * - Withdrawals where account is fromAccount: SUBTRACT amount
 * - Transfers where account is fromAccount (outgoing): SUBTRACT amount
 * Only completed transactions are considered.
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
    const completedTransactions = transactions.filter(
      (t) => t.status === TransactionStatus.COMPLETED
    );

    let balance = 0;

    for (const t of completedTransactions) {
      if (t.type === TransactionType.DEPOSIT && t.toAccount === accountId) {
        balance += t.amount;
      } else if (t.type === TransactionType.WITHDRAWAL && t.fromAccount === accountId) {
        balance -= t.amount;
      } else if (t.type === TransactionType.TRANSFER) {
        if (t.toAccount === accountId) {
          balance += t.amount;
        }
        if (t.fromAccount === accountId) {
          balance -= t.amount;
        }
      }
    }

    const response: BalanceResponse = {
      accountId,
      balance,
      currency: "USD",
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      buildErrorResponse("Internal server error"),
      { status: 500 }
    );
  }
}
