// Error handling utilities and classes

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public errors: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, public query?: string) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}

// Error codes for different scenarios
export const ErrorCodes = {
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Database errors
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  
  // Network errors
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // File system errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
  DISK_FULL: 'DISK_FULL',
  
  // Application errors
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  OPERATION_CANCELLED: 'OPERATION_CANCELLED'
} as const;

// Error handler function
export function handleError(error: unknown): AppError {
  console.error('Error occurred:', error);

  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }

  // Handle different types of errors
  if (error instanceof Error) {
    // Check for Tauri-specific errors
    if (error.message.includes('database')) {
      return new DatabaseError(error.message);
    }
    
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return new NetworkError(error.message, error);
    }
    
    if (error.message.includes('permission') || error.message.includes('access')) {
      return new AppError(error.message, ErrorCodes.PERMISSION_DENIED, 403);
    }
    
    // Generic error
    return new AppError(error.message, 'UNKNOWN_ERROR', 500);
  }

  // Handle string errors
  if (typeof error === 'string') {
    return new AppError(error, 'UNKNOWN_ERROR', 500);
  }

  // Fallback for unknown error types
  return new AppError('An unknown error occurred', 'UNKNOWN_ERROR', 500);
}

// Error formatter for user display
export function formatErrorForUser(error: AppError): string {
  switch (error.code) {
    case ErrorCodes.VALIDATION_FAILED:
      return 'Please check your input and try again.';
    
    case ErrorCodes.DATABASE_CONNECTION_FAILED:
      return 'Unable to connect to the database. Please try again later.';
    
    case ErrorCodes.NETWORK_UNAVAILABLE:
      return 'You are currently offline. Some features may not be available.';
    
    case ErrorCodes.FILE_NOT_FOUND:
      return 'The requested file could not be found.';
    
    case ErrorCodes.PERMISSION_DENIED:
      return 'You do not have permission to perform this action.';
    
    case ErrorCodes.DUPLICATE_RECORD:
      return 'A record with this information already exists.';
    
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

// Retry utility for failed operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
}

// Graceful degradation helper
export async function tryWithFallback<T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T> | T,
  errorPredicate?: (error: Error) => boolean
): Promise<T> {
  try {
    return await primaryOperation();
  } catch (error) {
    const shouldUseFallback = errorPredicate ? 
      errorPredicate(error instanceof Error ? error : new Error(String(error))) : 
      true;
    
    if (shouldUseFallback) {
      return await fallbackOperation();
    }
    
    throw error;
  }
}

// Error boundary helpers for React components
export interface ErrorInfo {
  error: Error;
  errorInfo: React.ErrorInfo;
}

export function logError(error: Error, errorInfo?: React.ErrorInfo) {
  console.error('React Error Boundary caught an error:', error, errorInfo);
  
  // In a real app, you might want to send this to an error reporting service
  // reportErrorToService(error, errorInfo);
}

// Type guards
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

// Error recovery suggestions
export function getRecoverySuggestions(error: AppError): string[] {
  const suggestions: string[] = [];

  switch (error.code) {
    case ErrorCodes.NETWORK_UNAVAILABLE:
      suggestions.push('Check your internet connection');
      suggestions.push('Try again when back online');
      break;
    
    case ErrorCodes.DATABASE_CONNECTION_FAILED:
      suggestions.push('Restart the application');
      suggestions.push('Check if you have enough disk space');
      break;
    
    case ErrorCodes.VALIDATION_FAILED:
      suggestions.push('Review the form for any missing or incorrect information');
      suggestions.push('Ensure all required fields are filled');
      break;
    
    case ErrorCodes.FILE_ACCESS_DENIED:
      suggestions.push('Check file permissions');
      suggestions.push('Ensure the file is not in use by another application');
      break;
    
    default:
      suggestions.push('Try refreshing the page');
      suggestions.push('If the problem persists, contact support');
  }

  return suggestions;
}