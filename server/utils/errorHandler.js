// Safe error handling utilities

// Log error details internally but return safe messages to users
export function handleDatabaseError(error, res, operation = 'operation') {
  // Log full error internally for debugging
  console.error(`Database error during ${operation}:`, {
    code: error.code,
    message: error.message,
    // Don't log stack in production
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
  
  // Return safe messages to users based on error type
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    // Don't reveal database structure
    return res.status(409).json({ error: 'This value already exists' });
  }
  
  if (error.code === 'SQLITE_CONSTRAINT_FOREIGN_KEY') {
    return res.status(400).json({ error: 'Invalid reference' });
  }
  
  if (error.code === 'SQLITE_CONSTRAINT_NOT_NULL') {
    return res.status(400).json({ error: 'Required field missing' });
  }
  
  // Generic error for everything else
  return res.status(500).json({ error: `Failed to ${operation}` });
}

// Log internal errors without exposing details
export function logError(context, error) {
  const errorInfo = {
    context,
    message: error.message,
    code: error.code,
    timestamp: new Date().toISOString()
  };
  
  // In production, you'd send this to a logging service
  if (process.env.NODE_ENV === 'development') {
    errorInfo.stack = error.stack;
  }
  
  console.error('Application error:', errorInfo);
}

// Sanitize error messages for client
export function sanitizeErrorMessage(error) {
  // Never expose internal error messages to users
  const knownErrors = {
    'ECONNREFUSED': 'Service temporarily unavailable',
    'ETIMEDOUT': 'Request timed out',
    'ENOTFOUND': 'Service not found',
    'UNAUTHORIZED': 'Authentication required',
    'FORBIDDEN': 'Access denied'
  };
  
  if (error.code && knownErrors[error.code]) {
    return knownErrors[error.code];
  }
  
  // Generic message for unknown errors
  return 'An error occurred. Please try again.';
}