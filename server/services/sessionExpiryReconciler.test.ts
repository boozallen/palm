jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    auditRecord: {
      create: jest.fn(),
    },
  },
}));
jest.mock('@/server/services/sessionLastSeen', () => ({
  wasRecentlyActive: jest.fn(),
}));

import db from '@/server/db';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import { wasRecentlyActive } from '@/server/services/sessionLastSeen';
import {
  reconcileExpiredSessions,
  isRunning,
  __resetForTests,
} from './sessionExpiryReconciler';

const mockQueryRaw = db.$queryRaw as jest.Mock;
const mockCreate = db.auditRecord.create as jest.Mock;
const mockWasRecentlyActive = wasRecentlyActive as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  __resetForTests();
  mockCreate.mockResolvedValue({});
  mockWasRecentlyActive.mockResolvedValue(false);
});

describe('sessionExpiryReconciler', () => {
  it('does nothing when no sessions have expired', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const closed = await reconcileExpiredSessions();
    expect(closed).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('writes a UserSessionExpired record for each expired session', async () => {
    const lastEventAt = new Date('2026-08-17T10:00:00.000Z');
    mockQueryRaw.mockResolvedValue([
      { userId: 'user-1', userName: 'Valentyna Polunina', lastEventAt },
    ]);

    const closed = await reconcileExpiredSessions();

    expect(closed).toBe(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          event: AuditRecordEvent.UserSessionExpired,
          outcome: AuditRecordOutcome.Success,
          timestamp: expect.any(Date),
        }),
      }),
    );
    // Backdated to when the idle window elapsed, not to when the run fired.
    const writtenTimestamp: Date = mockCreate.mock.calls[0][0].data.timestamp;
    expect(writtenTimestamp.getTime()).toBeGreaterThan(lastEventAt.getTime());
  });

  it('does not throw when a candidate write fails, and still closes the rest', async () => {
    mockQueryRaw.mockResolvedValue([
      { userId: 'user-1', userName: 'User One', lastEventAt: new Date() },
      { userId: 'user-2', userName: 'User Two', lastEventAt: new Date() },
    ]);
    mockCreate
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValueOnce({});

    await expect(reconcileExpiredSessions()).resolves.toBe(2);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('does not close a session whose user has real, unaudited traffic (e.g. plain chat use)', async () => {
    mockQueryRaw.mockResolvedValue([
      { userId: 'user-1', userName: 'Still Active', lastEventAt: new Date() },
    ]);
    mockWasRecentlyActive.mockResolvedValueOnce(true);

    const closed = await reconcileExpiredSessions();

    expect(closed).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('skips a run already in progress', async () => {
    let resolveQuery: (value: []) => void = () => {};
    mockQueryRaw.mockReturnValue(new Promise((resolve) => { resolveQuery = resolve; }));

    const firstRun = reconcileExpiredSessions();
    expect(isRunning()).toBe(true);

    const secondRunResult = await reconcileExpiredSessions();
    expect(secondRunResult).toBe(0);

    resolveQuery([]);
    await firstRun;
    expect(isRunning()).toBe(false);
  });
});
