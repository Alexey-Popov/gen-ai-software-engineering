import { NextRequest, NextResponse } from "next/server";
import { getAll } from "@/lib/store";
import { transactionsToCsv } from "@/lib/csv";
import { buildErrorResponse } from "@/lib/errors";

/**
 * GET /api/transactions/export
 * Exports all transactions as CSV when format=csv query parameter is provided.
 */
export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get("format");

    if (!format || format !== "csv") {
      return NextResponse.json(
        buildErrorResponse("Missing or invalid format parameter. Use format=csv"),
        { status: 400 }
      );
    }

    const transactions = getAll();
    const csv = transactionsToCsv(transactions);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=transactions.csv",
      },
    });
  } catch (error) {
    return NextResponse.json(
      buildErrorResponse("Internal server error"),
      { status: 500 }
    );
  }
}
