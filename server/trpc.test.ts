import { TRPCError } from '@trpc/server';

import { defaultErrorMiddleware } from './trpc';
import type { ContextType } from './trpc-context';

describe('tRPC defaultErrorMiddleware', () => {
  it('should wrap non-TRPCError errors errors in a TRPCError', async () => {
    const cause = new Error('buh');
    const arg = {
      ctx: {
        userId: 'test-user-id',
        userRole: 'test-role',
        prisma: {},
        logger: { error: jest.fn() },
        auditor: {},
        ai: {},
        kb: {},
      } as unknown as ContextType,
      next: jest.fn().mockRejectedValue(cause),
      type: 'query' as const,
      path: '',
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
  });

  it('should simply rethrow errors already of type TRPCError', async () => {
    const cause = new TRPCError({ code: 'NOT_FOUND' });
    const arg = {
      ctx: {
        userId: 'test-user-id',
        userRole: 'test-role',
        prisma: {},
        logger: { error: jest.fn() },
        auditor: {},
        ai: {},
        kb: {},
      } as unknown as ContextType,
      next: jest.fn().mockRejectedValue(cause),
      type: 'query' as const,
      path: '',
      input: null,
      rawInput: null,
      meta: undefined,
      getRawInput: jest.fn(),
      signal: undefined,
    };
    const promise = defaultErrorMiddleware._middlewares[0](arg);
    await expect(promise).rejects.toThrow(cause);
    expect(arg.ctx.logger.error).toHaveBeenCalled();
  });
});
