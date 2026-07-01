import { NextRequest, NextResponse } from "next/server";
import { create, filter } from "@/lib/store";
import { validateTransaction } from "@/lib/validator";
import { buildErrorResponse } from "@/lib/errors";
import { CreateTransactionInput, FilterCriteria, TransactionType } from "@/lib/types";

/**
 * POST /api/transactions
 * Creates a new transaction after validating the request body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const errors = validateTransaction(body);
    if (errors.length > 0) {
      return NextResponse.json(
        buildErrorResponse("Validation failed", errors),
        { status: 400 }
      );
    }

    const input: CreateTransactionInput = {
      fromAccount: body.fromAccount,
      toAccount: body.toAccount,
      amount: body.amount,
      currency: body.currency,
      type: body.type,
    };

    const transaction = create(input);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    // Handle JSON parse errors (invalid request body)
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        buildErrorResponse("Validation failed", [
          { field: "body", message: "Request body must be valid JSON" },
        ]),
        { status: 400 }
      );
    }

    return NextResponse.json(
      buildErrorResponse("Internal server error"),
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions
 * Lists transactions with optional filters: accountId, type, from, to.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const accountId = searchParams.get("accountId") || undefined;
    const typeParam = searchParams.get("type") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    // Validate type parameter against TransactionType enum values
    let type: TransactionType | undefined;
    if (typeParam) {
      const validTypes = Object.values(TransactionType) as string[];
      if (validTypes.includes(typeParam)) {
        type = typeParam as TransactionType;
      } else {
        // Invalid type value - return empty results
        return NextResponse.json([], { status: 200 });
      }
    }

    const criteria: FilterCriteria = {
      accountId,
      type,
      from,
      to,
    };

    const results = filter(criteria);
    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      buildErrorResponse("Internal server error"),
      { status: 500 }
    );
  }
}
