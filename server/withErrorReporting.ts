import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { TRPCError } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { ZodError } from 'zod';
import { createErrorAuditor } from '@/server/errorAuditor';
import logger from '@/server/logger';

export interface WithErrorReportingOptions {
  // Internal-API-key routes have no session to resolve a userId from; they can
  // pass one through explicitly (e.g. read from the request body) instead.
  resolveUserId?: (req: NextApiRequest) => string | null | Promise<string | null>;
}

// Lazily required: next-auth pulls in jose's ESM browser build, which breaks
// any Jest suite that merely imports this module transitively (e.g. a worker
// importing an internal-API-key route that wraps its handler here). A
// top-level import would load that chain just from being required, even for
// callers that always pass their own resolveUserId and never hit this path.
async function resolveSessionUserId(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  try {
    const { getServerSession } = await import('next-auth/next');
    const { authOptions } = await import('@/server/auth-adapter');
    const session = await getServerSession(req, res, await authOptions());
    return session?.user.id ?? null;
  } catch {
    return null;
  }
}

function toTRPCError(cause: unknown): TRPCError {
  if (cause instanceof TRPCError) {
    return cause;
  }

  if (cause instanceof ZodError) {
    return new TRPCError({ code: 'BAD_REQUEST', message: cause.message, cause });
  }

  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause });
}

// REST equivalent of server/trpc.ts's defaultErrorMiddleware: wraps a
// NextApiHandler so every uncaught error is both recorded as an ErrorRecord
// and answered with an explicit status, instead of Next's generic unlogged 500.
export function withErrorReporting(
  handler: NextApiHandler,
  options?: WithErrorReportingOptions,
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (cause) {
      logger.error(cause);

      const error = toTRPCError(cause);
      const userId = options?.resolveUserId
        ? await options.resolveUserId(req)
        : await resolveSessionUserId(req, res);

      createErrorAuditor({ userId }).createErrorRecord({
        source: 'rest-api',
        route: req.url ?? null,
        code: error.code,
        message: error.message,
        stack: cause instanceof Error ? cause.stack ?? null : null,
        metadata: { method: req.method },
      });

      if (!res.headersSent) {
        res.status(getHTTPStatusCodeFromError(error)).json({ error: error.message });
      }
    }
  };
}
