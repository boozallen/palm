import { initTRPC, TRPCError } from '@trpc/server';
import type { ContextType } from './trpc-context';

const t = initTRPC.context<ContextType>().create();
const { middleware, router } = t;

export const defaultErrorMiddleware = middleware(async ({ ctx, next }) => {
  try {
    return await next();
  } catch (cause: unknown) {
    ctx.logger.error(cause);
    if (cause instanceof TRPCError) {
      throw cause;
    }
    let code: InstanceType<typeof TRPCError>['code'] = 'INTERNAL_SERVER_ERROR';
    const props = {};

    if (cause instanceof Object) {
      Object.assign(props, { ...cause, cause });
    }

    throw new TRPCError({ ...props, code });
  }
});

const procedure = t.procedure.use(defaultErrorMiddleware);

export { middleware, procedure, router };
