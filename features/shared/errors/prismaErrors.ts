import { Prisma } from '@prisma/client';
export class PrismaError extends Error {
  constructor(message: string, public originalError: unknown) {
    super(message);
    this.name = 'PrismaError';
  }
}

const ERROR_MESSAGES: { [key: string]: string } = {
  P1000: 'Unable to connect to the database',
  P1001: 'Unable to connect to the database',
  P1002: 'Database connected but timed out',
  P1003: 'Database does not exist or is not accessible',
  P1008: 'Database operation timed out',
  P1009: 'Database already exists',
  P1010: 'Access to the database was denied',
  P1011: 'Error opening TLS connection',
  P1012: 'Invalid database schema or configuration',
  P1013: 'Invalid database schema or configuration',
  P1014: 'Invalid database schema or configuration',
  P1015: 'Invalid database schema or configuration',
  P1016: 'Database query error',
  P1017: 'Server has closed connection',
  P2000: 'Provided value too long for column',
  P2001: 'Required record not found',
  P2002: 'Unique constraint violation',
  P2003: 'Foreign key constraint violation',
  P2004: 'Constraint violation in the database',
  P2005: 'Invalid data provided',
  P2006: 'Invalid data provided',
  P2007: 'Invalid data provided',
  P2008: 'Database query parsing error',
  P2009: 'Database query validation error',
  P2010: 'Database query execution error',
  P2011: 'Null constraint violation in the database',
  P2012: 'Missing required field',
  P2013: 'Missing required argument',
  P2014: 'Required relation violation',
  P2015: 'Required record not found',
  P2016: 'Query interpretation error',
  P2017: 'Query interpretation error',
  P2018: 'Required record not found',
  P2019: 'Input error',
  P2020: 'Value out of range',
  P2021: 'Table does not exist',
  P2022: 'Column does not exist',
  P2023: 'Inconsistent data in the database',
  P2024: 'Timeout fetching new connection from pool',
  P2025: 'Required record not found',
  P2026: 'Operation not supported by database',
  P2027: 'Multiple errors occurred',
  P2028: 'Transaction API error',
  P2029: 'Query parameter limit exceeded',
  P2030: 'Full-text search index not found',
  P2033: 'Number out of range',
  P2034: 'Transaction error',
  P2035: 'Database assertion failure',
  P2036: 'Error in external database connector',
  P2037: 'Too many connections',
};

/**
 * Handles Prisma errors by returning a sanitized error message.
 * If the error is a known Prisma error, returns a custom message.
 * Otherwise, returns a generic error message.
 *
 * @param {unknown} error - The error thrown by Prisma operations.
 * @returns {string} A sanitized error message.
 */
export function handlePrismaError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      ERROR_MESSAGES[error.code] || 'An unexpected database error occurred'
    );
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return 'The database query was invalid';
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'The database could not be initialized';
  }
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return 'A critical database error occurred';
  }

  if (error instanceof Error) {
    return error.message;
  }

  // For any other type of error
  return 'An unexpected error occurred';
}
