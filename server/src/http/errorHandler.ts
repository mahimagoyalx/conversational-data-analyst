import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { QueryBuilderError } from "../services/queryBuilder.js";
import { clientErrorBody, ErrorCodes, HttpError } from "./errors.js";

function isJsonSyntaxError(err: unknown): boolean {
  return err instanceof SyntaxError && "body" in err;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  void req;
  void next;

  if (err instanceof HttpError) {
    res.status(err.status).json(clientErrorBody(err.code, err.message));
    return;
  }

  if (err instanceof ZodError || isJsonSyntaxError(err)) {
    res.status(400).json(
      clientErrorBody(
        ErrorCodes.INVALID_REQUEST,
        "Request body must be a JSON object with a non-empty question.",
      ),
    );
    return;
  }

  if (err instanceof QueryBuilderError) {
    res.status(500).json(
      clientErrorBody(
        ErrorCodes.INVALID_PLAN,
        "I couldn't answer that question with the available analytics.",
      ),
    );
    return;
  }

  res.status(500).json(
    clientErrorBody(
      ErrorCodes.INTERNAL_ERROR,
      "Something went wrong while answering your question.",
    ),
  );
};
