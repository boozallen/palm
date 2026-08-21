import assertDocumentAccess from './assertDocumentAccess';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

describe('assertDocumentAccess', () => {
  const userId = 'user-1';
  const accessibleSet = new Set(['doc-a', 'doc-b', 'doc-c']) as unknown as AccessibleDocIds;

  const makeCtx = (overrides: Partial<{ logger: { warn: jest.Mock } }> = {}) => ({
    userId,
    getAccessibleDocIds: jest.fn().mockResolvedValue(accessibleSet),
    logger: overrides.logger,
  });

  it('returns the accessible set when every requested id is accessible (array)', async () => {
    const ctx = makeCtx();
    const result = await assertDocumentAccess(ctx as never, ['doc-a', 'doc-b']);

    expect(result).toBe(accessibleSet);
  });

  it('throws Forbidden when one requested id is inaccessible (array)', async () => {
    const ctx = makeCtx();
    await expect(
      assertDocumentAccess(ctx as never, ['doc-a', 'unknown-doc']),
    ).rejects.toThrow('One or more documents are not accessible');
  });

  it('throws Forbidden when all requested ids are inaccessible (array)', async () => {
    const ctx = makeCtx();
    await expect(
      assertDocumentAccess(ctx as never, ['unknown-1', 'unknown-2']),
    ).rejects.toThrow('One or more documents are not accessible');
  });

  it('returns the accessible set without invoking inaccessibility check on empty array', async () => {
    const ctx = makeCtx();
    const result = await assertDocumentAccess(ctx as never, []);

    expect(result).toBe(accessibleSet);
  });

  it('returns the set when a single-id (string) input is accessible', async () => {
    const ctx = makeCtx();
    const result = await assertDocumentAccess(ctx as never, 'doc-a');

    expect(result).toBe(accessibleSet);
  });

  it('throws Forbidden when a single-id (string) input is inaccessible', async () => {
    const ctx = makeCtx();
    await expect(
      assertDocumentAccess(ctx as never, 'unknown-doc'),
    ).rejects.toThrow('One or more documents are not accessible');
  });

  it('logs warn with counts only, never with inaccessible ids', async () => {
    const warn = jest.fn();
    const ctx = makeCtx({ logger: { warn } });

    await expect(
      assertDocumentAccess(ctx as never, ['doc-a', 'leak-1', 'leak-2']),
    ).rejects.toThrow();

    expect(warn).toHaveBeenCalledWith(
      '[ACCESS] User attempted to query inaccessible documents',
      expect.objectContaining({
        userId,
        requestedCount: 3,
        inaccessibleCount: 2,
      }),
    );
    const logPayload = warn.mock.calls[0][1] as Record<string, unknown>;
    expect(JSON.stringify(logPayload)).not.toContain('leak-1');
    expect(JSON.stringify(logPayload)).not.toContain('leak-2');
  });
});
