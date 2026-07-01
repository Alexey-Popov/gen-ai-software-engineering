/**
 * Error Response Builder - utility for building consistent error JSON responses.
 */

import { ErrorResponse, ValidationError } from "./types";

/**
 * Builds a consistent error response with an error message and optional validation details.
 */
export function buildErrorResponse(
  message: string,
  details?: ValidationError[]
): ErrorResponse {
  const response: ErrorResponse = { error: message };
  if (details && details.length > 0) {
    response.details = details;
  }
  return response;
}

/**
 * Builds a not-found error response for a specific resource.
 */
export function buildNotFoundResponse(
  resource: string,
  id: string
): ErrorResponse {
  return { error: `${resource} not found` };
}
