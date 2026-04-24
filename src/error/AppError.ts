type constructorArg = {
  statusCode: number;
  type: string;
  message: string;
  extra?: object;
};
export class AppError extends Error {
  statusCode;
  type;
  extra;
  isOperational;
  isStream;
  constructor(
    { statusCode, type, message, extra = {} }: constructorArg,
    isStream = false,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.type = type;
    this.extra = extra;
    this.isStream = isStream;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
