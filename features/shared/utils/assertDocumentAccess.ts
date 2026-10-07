import type { Logger } from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import { Forbidden } from '@/features/shared/errors/routeErrors';

type AccessCtx = {
  userId: string;
  getAccessibleDocIds: () => Promise<AccessibleDocIds>;
  logger?: Logger;
};

export default async function assertDocumentAccess(
  ctx: AccessCtx,
  requestedDocIds: string[] | string,
): Promise<AccessibleDocIds> {
  const requested = Array.isArray(requestedDocIds) ? requestedDocIds : [requestedDocIds];
  const accessible = await ctx.getAccessibleDocIds();

  if (requested.length === 0) {
    return accessible;
  }

  const inaccessible = requested.filter((id) => !accessible.has(id));
  if (inaccessible.length > 0) {
    ctx.logger?.warn('[ACCESS] User attempted to query inaccessible documents', {
      userId: ctx.userId,
      requestedCount: requested.length,
      inaccessibleCount: inaccessible.length,
    });
    throw Forbidden('One or more documents are not accessible');
  }

  return accessible;
}
