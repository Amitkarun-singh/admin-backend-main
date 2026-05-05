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

  constructor({ statusCode, type, message, extra = {} }: constructorArg) {
    super(message);

    this.statusCode = statusCode;
    this.type = type;
    this.extra = extra;

    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
