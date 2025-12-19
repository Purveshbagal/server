const logger = require('../utils/logger');
const { AppError, ValidationError } = require('../utils/customErrors');

const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log error
  logger.error('Error occurred', {
    message: err.message,
    statusCode: err.statusCode || 500,
    errorCode: err.errorCode || 'UNKNOWN_ERROR',
    url: req.url,
    method: req.method,
    stack: isDevelopment ? err.stack : undefined,
  });

  // Handle AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
    return res.status(400).json({
      message: 'Validation Error',
      errorCode: 'VALIDATION_ERROR',
      statusCode: 400,
      details,
    });
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      message: `${field} already exists`,
      errorCode: 'CONFLICT',
      statusCode: 409,
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token',
      errorCode: 'AUTHENTICATION_ERROR',
      statusCode: 401,
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired',
      errorCode: 'TOKEN_EXPIRED',
      statusCode: 401,
    });
  }

  // Handle multer errors
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    if (err.code === 'FILE_TOO_LARGE') {
      message = 'File size exceeds maximum limit';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files';
    }
    return res.status(400).json({
      message,
      errorCode: 'UPLOAD_ERROR',
      statusCode: 400,
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = isDevelopment ? err.message : 'Internal Server Error';

  res.status(statusCode).json({
    message,
    errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR',
    statusCode,
    ...(isDevelopment && { stack: err.stack }),
  });
};

module.exports = errorHandler;
