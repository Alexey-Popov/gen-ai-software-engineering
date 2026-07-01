import { NextRequest, NextResponse } from "next/server";
import { getAll } from "@/lib/store";
import { validateAccountId, validateRateParam, validateDaysParam } from "@/lib/validator";
import { TransactionStatus, TransactionType, InterestResponse } from "@/lib/types";
import { buildErrorResponse } from "@/lib/errors";

/**
 * GET /api/accounts/:accountId/interest
 * Calculates simple interest on the account balance.
 * Formula: balance * rate * days / 365
 * Query params: rate (positive number), days (positive integer)
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

    const { searchParams } = new URL(request.url);
    const rateParam = searchParams.get("rate");
    const daysParam = searchParams.get("days");

    if (!validateRateParam(rateParam)) {
      return NextResponse.json(
        buildErrorResponse("Rate must be a positive number"),
        { status: 400 }
      );
    }

    if (!validateDaysParam(daysParam)) {
      return NextResponse.json(
        buildErrorResponse("Days must be a positive integer"),
        { status: 400 }
      );
    }

    const rate = Number(rateParam);
    const days = Number(daysParam);

    // Calculate balance from completed transactions (same logic as balance endpoint)
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

    // Calculate simple interest: balance * rate * days / 365
    const interest = balance * rate * days / 365;

    const response: InterestResponse = {
      accountId,
      balance,
      rate,
      days,
      interest,
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      buildErrorResponse("Internal server error"),
      { status: 500 }
    );
  }
}
