import { initTRPC, TRPCError } from '@trpc/server';
import type { ContextType } from './trpc-context';

const t = initTRPC.context<ContextType>().create();
const { middleware, router } = t;

export const defaultErrorMiddleware = middleware(async ({ ctx, path, type, next }) => {
  try {
    return await next();
  } catch (cause: unknown) {
    ctx.logger.error(cause);

    let error: TRPCError;
    if (cause instanceof TRPCError) {
      error = cause;
    } else {
      const code: InstanceType<typeof TRPCError>['code'] = 'INTERNAL_SERVER_ERROR';
      const props = {};

      if (cause instanceof Object) {
        Object.assign(props, { ...cause, cause });
      }

      error = new TRPCError({ ...props, code });
    }

    await ctx.errorAuditor.createErrorRecord({
      source: 'trpc',
      route: path,
      code: error.code,
      message: error.message,
      stack: cause instanceof Error ? cause.stack ?? null : null,
      metadata: { type },
    });

    throw error;
  }
});

const procedure = t.procedure.use(defaultErrorMiddleware);

export { middleware, procedure, router };
