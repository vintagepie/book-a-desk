import pino from "pino";

const isProduction = process.env.NODE_ENV === "production" || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
});

