import { getServerSession } from 'next-auth/next';
import type { NextApiHandler } from 'next';
import { z } from 'zod';

import { authOptions } from '@/server/auth-adapter';
import { createErrorAuditor } from '@/server/errorAuditor';

const inputSchema = z.object({
  kind: z.enum(['react-render', 'window-error', 'unhandled-rejection']),
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  componentStack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
});

const codeByKind = {
  'react-render': 'REACT_RENDER_ERROR',
  'window-error': 'WINDOW_ERROR',
  'unhandled-rejection': 'UNHANDLED_REJECTION',
} as const;

// The frontend's error-recording chokepoint: both AppErrorBoundary and
// GlobalErrorListener report here. Never surfaces its own errors to the
// caller — there is no UI to show a failure to — so it always ends in 204.
const recordClientError: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(204).end();
    return;
  }

  const { kind, message, stack, componentStack, url } = parsed.data;
  // Tolerant of a missing/expired session, unlike tRPC context creation
  // (server/trpc-context.ts), which throws without one — a global frontend
  // error reporter has to survive exactly that case.
  const session = await getServerSession(req, res, await authOptions()).catch(() => null);
  const userId = session?.user.id ?? null;

  createErrorAuditor({ userId }).createErrorRecord({
    source: 'frontend',
    route: url ?? null,
    code: codeByKind[kind],
    message,
    stack: stack ?? null,
    metadata: componentStack ? { componentStack } : null,
  });

  res.status(204).end();
};

export default recordClientError;
