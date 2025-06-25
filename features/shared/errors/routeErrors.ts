import { TRPCError } from '@trpc/server';

export function NotFound(msg: string): TRPCError {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: msg,
  });
}

export function Forbidden(msg: string): TRPCError {
  return new TRPCError({
    code: 'FORBIDDEN',
    message: msg,
  });
}

export function Unauthorized(msg: string): TRPCError {
  return new TRPCError({
    code: 'UNAUTHORIZED',
    message: msg,
  });
}

export function BadRequest(msg: string): TRPCError {
  return new TRPCError({
    code: 'BAD_REQUEST',
    message: msg,
  });
}

export function InternalServerError(msg: string): TRPCError {
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: msg,
  });
}
