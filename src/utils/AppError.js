class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    { code = null, details = null, retryAfter = null } = {},
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
