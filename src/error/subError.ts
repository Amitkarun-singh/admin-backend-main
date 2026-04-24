import { AppError } from "./AppError.ts";
type FieldError = {
  field: string;
  message: string;
  code: string;
};
export class ValidationError extends AppError {
  constructor(errors: Array<FieldError>) {
    super({
      statusCode: 422,
      type: "VALIDATION_ERROR",
      message: "Validation failed",
      extra: { errors },
    });
  }
}
export class AuthenticationError extends AppError {
  constructor(message = "No valid authentication credentials provided") {
    super({
      statusCode: 401,
      type: "AUTHENTICATION_REQUIRED",
      message,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super({
      statusCode: 404,
      type: "RESOURCE_NOT_FOUND",
      message: `${resource} '${id}' not found`,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, existing?: object) {
    super({
      statusCode: 409,
      type: "DUPLICATE_RESOURCE",
      message,
      extra: { existing },
    });
  }
}

export class RateLimitError extends AppError {
  constructor(
    retryAfter: number,
    limit?: number,
    remaining?: number,
    reset?: number,
  ) {
    super({
      statusCode: 429,
      type: "RATE_LIMIT_EXCEEDED",
      message: `Too many requests. Try again in ${retryAfter} seconds.`,
      extra: {
        retryAfter,
        limit,
        remaining,
        reset,
      },
    });
  }
}

export class InternalServerError extends AppError {
  constructor(traceId?: string) {
    super({
      statusCode: 500,
      type: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      extra: { traceId },
    });
  }
}

// export class InternalServerErrorStream extends AppError {
//   constructor(traceId?: string) {
//     super(
//       {
//         statusCode: 500,
//         type: "INTERNAL_ERROR",
//         message: "An unexpected error occurred",
//         extra: { traceId },
//       },
//       true,
//     );
//   }
// }
