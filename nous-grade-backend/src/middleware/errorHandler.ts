// Global error handling middleware
import { Request, Response, NextFunction } from 'express';
import { APIError, ErrorCode } from '../types';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, any>;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error for debugging
  console.error('🔴 Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || ErrorCode.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Internal server error';
  let details = err.details || {};

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = { validationErrors: err.message };
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    errorCode = ErrorCode.IMAGE_TOO_LARGE;
    message = 'File upload error';
    details = { multerError: err.message };
  } else if (err.message.includes('rate limit')) {
    statusCode = 429;
    errorCode = ErrorCode.RATE_LIMIT_EXCEEDED;
  } else if (err.message.includes('unauthorized')) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  }

  // Create API error response
  const apiError: APIError = {
    code: errorCode,
    message,
    details,
    timestamp: new Date()
  };

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: apiError,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      originalError: err.message
    })
  });
};

/**
 * Create a custom error
 */
export const createError = (
  message: string,
  statusCode: number = 500,
  code: string = ErrorCode.INTERNAL_SERVER_ERROR,
  details?: Record<string, any>
): CustomError => {
  const error = new Error(message) as CustomError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
