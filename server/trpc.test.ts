import { TRPCError } from '@trpc/server';

import { defaultErrorMiddleware } from './trpc';
import type { ContextType } from './trpc-context';

describe('tRPC defaultErrorMiddleware', () => {
  it('should wrap non-TRPCError errors errors in a TRPCError', async () => {
    const cause = new Error('buh');
    const createErrorRecord = jest.fn();
    const arg = {
      ctx: {
        userId: 'test-user-id',
        userRole: 'test-role',
        prisma: {},
        logger: { error: jest.fn() },
        auditor: {},
        errorAuditor: { createErrorRecord },
        ai: {},
        kb: {},
      } as unknown as ContextType,
      next: jest.fn().mockRejectedValue(cause),
      type: 'query' as const,
      path: 'settings.getUsersListWithRole',
      input: null,
      rawInput: null,
      meta: undefined,
      getRawInput: jest.fn(),
      signal: undefined,
    };
    const promise = defaultErrorMiddleware._middlewares[0](arg);
    await expect(promise).rejects.toThrow(
      new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause })
    );
    expect(arg.ctx.logger.error).toHaveBeenCalled();
    expect(createErrorRecord).toHaveBeenCalledWith({
      source: 'trpc',
      route: 'settings.getUsersListWithRole',
      code: 'INTERNAL_SERVER_ERROR',
      message: cause.message,
      stack: cause.stack,
      metadata: { type: 'query' },
    });
  });

  it('should simply rethrow errors already of type TRPCError', async () => {
    const cause = new TRPCError({ code: 'NOT_FOUND' });
    const createErrorRecord = jest.fn();
    const arg = {
      ctx: {
        userId: 'test-user-id',
        userRole: 'test-role',
        prisma: {},
        logger: { error: jest.fn() },
        auditor: {},
        errorAuditor: { createErrorRecord },
        ai: {},
        kb: {},
      } as unknown as ContextType,
      next: jest.fn().mockRejectedValue(cause),
      type: 'query' as const,
      path: 'settings.getUsersListWithRole',
      input: null,
      rawInput: null,
      meta: undefined,
      getRawInput: jest.fn(),
      signal: undefined,
    };
    const promise = defaultErrorMiddleware._middlewares[0](arg);
    await expect(promise).rejects.toThrow(cause);
    expect(arg.ctx.logger.error).toHaveBeenCalled();
    expect(createErrorRecord).toHaveBeenCalledWith({
      source: 'trpc',
      route: 'settings.getUsersListWithRole',
      code: 'NOT_FOUND',
      message: cause.message,
      stack: cause.stack,
      metadata: { type: 'query' },
    });
  });
});
