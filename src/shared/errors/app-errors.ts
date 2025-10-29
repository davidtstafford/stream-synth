/**
 * Application Error Classes
 * 
 * Centralized error hierarchy for consistent error handling
 * across backend handlers and frontend services
 */

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details
    };
  }
}

export class ValidationError extends AppError {
  constructor(
    public errors: Record<string, string>,
    message: string = 'Validation failed'
  ) {
    super('VALIDATION_ERROR', message, 400, { errors });
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super('NOT_FOUND', message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(resource: string, message?: string) {
    super(
      'CONFLICT',
      message || `${resource} already exists`,
      409
    );
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super('INTERNAL_ERROR', message, 500, details);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

export class ConfigurationError extends AppError {
  constructor(
    service: string,
    requiredFields: string[],
    message?: string
  ) {
    super(
      'CONFIGURATION_ERROR',
      message || `${service} is not properly configured. Required: ${requiredFields.join(', ')}`,
      400,
      { service, requiredFields }
    );
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string,
    originalError?: Error
  ) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      `${service} error: ${message}`,
      500,
      { service, originalError: originalError?.message }
    );
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string, timeoutMs: number) {
    super(
      'TIMEOUT_ERROR',
      `${operation} timed out after ${timeoutMs}ms`,
      408,
      { operation, timeoutMs }
    );
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert any error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message);
  }

  return new InternalError(String(error));
}
