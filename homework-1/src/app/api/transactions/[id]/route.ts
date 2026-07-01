import { NextRequest, NextResponse } from "next/server";
import { getById } from "@/lib/store";
import { buildNotFoundResponse, buildErrorResponse } from "@/lib/errors";

/**
 * GET /api/transactions/:id
 * Retrieves a single transaction by its ID.
 * Returns 200 with the transaction if found, or 404 if not found.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transaction = getById(id);
    if (!transaction) {
      return NextResponse.json(buildNotFoundResponse("Transaction", id), {
        status: 404,
      });
    }

    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    return NextResponse.json(buildErrorResponse("Internal server error"), {
      status: 500,
    });
  }
}
