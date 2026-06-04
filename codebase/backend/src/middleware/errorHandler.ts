import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = (err as { status?: number }).status ?? 500;
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(status).json({ code: "ERROR", message });
};
