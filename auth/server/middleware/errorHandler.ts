/**
 * Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', error);

  let statusCode = 500;
  let message = 'Internal server error';
  let errorType = 'ServerError';

  if (error.name === 'ValidationError' || error.name === 'InquiryValidationError' || error.name === 'ReportValidationError') {
    statusCode = 400;
    message = error.message;
    errorType = 'ValidationError';
  } else if (error.name === 'UserNotFoundError') {
    statusCode = 404;
    message = 'User not found';
    errorType = 'NotFoundError';
  } else if (error.name === 'SelfReportError') {
    statusCode = 400;
    message = error.message;
    errorType = 'ValidationError';
  } else if (error.name === 'DuplicateReportError') {
    statusCode = 409;
    message = error.message;
    errorType = 'ConflictError';
  } else if (error.name === 'InvalidReportReasonError') {
    statusCode = 400;
    message = error.message;
    errorType = 'ValidationError';
  } else if (error.name === 'NicknameAlreadyExistsError') {
    statusCode = 409;
    message = error.message;
    errorType = 'ConflictError';
  } else if (error.name === 'UnauthorizedError' || error.message?.includes('token')) {
    statusCode = 401;
    message = 'Unauthorized';
    errorType = 'AuthenticationError';
  } else if (error.code === '23505') {
    statusCode = 409;
    message = 'Resource already exists';
    errorType = 'ConflictError';
  } else if (error.code === '23503') {
    statusCode = 400;
    message = 'Invalid reference';
    errorType = 'ValidationError';
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message || message;
  }

  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred';
  }

  res.status(statusCode).json({
    error: errorType,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
