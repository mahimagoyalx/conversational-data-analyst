export const ErrorCodes = {
  INVALID_REQUEST: "invalid_request",
  UNSUPPORTED_QUESTION: "unsupported_question",
  INVALID_PLAN: "invalid_plan",
  DATABASE_ERROR: "database_error",
  INTERNAL_ERROR: "internal_error",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function clientErrorBody(code: ErrorCode, message: string) {
  return {
    success: false as const,
    error: { code, message },
  };
}
