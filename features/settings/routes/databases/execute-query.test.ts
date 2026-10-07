import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import executeReadOnlyQuery from '@/features/settings/dal/databases/executeReadOnlyQuery';
import getUser from '@/features/settings/dal/shared/getUser';
import settingsRouter from '@/features/settings/routes/index';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

jest.mock('@/features/settings/dal/databases/executeReadOnlyQuery');
jest.mock('@/features/settings/dal/shared/getUser');

describe('execute-query route', () => {
  const mockAuditor = {
    createAuditRecord: jest.fn(),
  };

  const ctx = {
    userRole: UserRole.Admin,
    userId: 'admin-user-id',
    auditor: mockAuditor,
  } as unknown as ContextType;

  const mockQueryResult = {
    columns: ['id', 'name', 'email'],
    rows: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ],
    rowCount: 2,
    executionTime: 150,
  };

  const mockUser = {
    id: 'admin-user-id',
    name: 'Admin User',
    email: 'admin@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue(mockUser);
    (executeReadOnlyQuery as jest.Mock).mockResolvedValue(mockQueryResult);
  });

  describe('authorization', () => {
    it('should allow Admin users to execute queries', async () => {
      const caller = settingsRouter.createCaller(ctx);

      const result = await caller.databases.executeQuery({
        query: 'SELECT * FROM "User" LIMIT 2',
      });

      expect(result).toEqual(mockQueryResult);
      expect(executeReadOnlyQuery).toHaveBeenCalledWith('SELECT * FROM "User" LIMIT 2');
    });

    it('should reject non-Admin users', async () => {
      const userCtx = {
        ...ctx,
        userRole: UserRole.User,
      };

      const caller = settingsRouter.createCaller(userCtx);

      await expect(
        caller.databases.executeQuery({
          query: 'SELECT * FROM "User"',
        }),
      ).rejects.toThrow(Unauthorized('You do not have permission to execute database queries'));

      expect(executeReadOnlyQuery).not.toHaveBeenCalled();
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Warn,
        description: 'User attempted to execute PostgreSQL query but lacked permissions',
        event: AuditRecordEvent.ExecutePostgresqlQuery,
      });
    });
  });

  describe('audit logging', () => {
    it('should create success audit record when query executes successfully', async () => {
      const caller = settingsRouter.createCaller(ctx);

      await caller.databases.executeQuery({
        query: 'SELECT * FROM "User" LIMIT 10',
      });

      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: 'User Admin User executed read-only PostgreSQL query: SELECT * FROM "User" LIMIT 10',
        event: AuditRecordEvent.ExecutePostgresqlQuery,
      });
    });

    it('should truncate long queries in audit logs', async () => {
      const caller = settingsRouter.createCaller(ctx);
      const longQuery = 'SELECT * FROM "User" WHERE '.padEnd(150, 'x');

      await caller.databases.executeQuery({
        query: longQuery,
      });

      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('...'),
        event: AuditRecordEvent.ExecutePostgresqlQuery,
      });

      const auditCall = mockAuditor.createAuditRecord.mock.calls[0][0];
      const descriptionLength = auditCall.description.length;
      expect(descriptionLength).toBeLessThan(longQuery.length + 100);
    });

    it('should create error audit record when query fails', async () => {
      (executeReadOnlyQuery as jest.Mock).mockRejectedValue(
        new Error('Failed to execute query: Invalid SQL syntax'),
      );

      const caller = settingsRouter.createCaller(ctx);

      await expect(
        caller.databases.executeQuery({
          query: 'SELECT * FROM InvalidTable',
        }),
      ).rejects.toThrow('Failed to execute query: Invalid SQL syntax');

      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Error,
        description: 'User Admin User failed to execute PostgreSQL query: SELECT * FROM InvalidTable - Failed to execute query: Invalid SQL syntax',
        event: AuditRecordEvent.ExecutePostgresqlQuery,
      });
    });

    it('should include user name in audit records', async () => {
      const customUser = {
        ...mockUser,
        name: 'John Doe',
      };
      (getUser as jest.Mock).mockResolvedValue(customUser);

      const caller = settingsRouter.createCaller(ctx);

      await caller.databases.executeQuery({
        query: 'SELECT COUNT(*) FROM "User"',
      });

      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('User John Doe executed'),
        }),
      );
    });
  });

  describe('query execution', () => {
    it('should pass query to executeReadOnlyQuery', async () => {
      const caller = settingsRouter.createCaller(ctx);
      const testQuery = 'SELECT id, name FROM "User" WHERE role = \'Admin\'';

      await caller.databases.executeQuery({
        query: testQuery,
      });

      expect(executeReadOnlyQuery).toHaveBeenCalledWith(testQuery);
    });

    it('should return query results with correct structure', async () => {
      const caller = settingsRouter.createCaller(ctx);

      const result = await caller.databases.executeQuery({
        query: 'SELECT * FROM "User"',
      });

      expect(result).toHaveProperty('columns');
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
      expect(result).toHaveProperty('executionTime');
      expect(Array.isArray(result.columns)).toBe(true);
      expect(Array.isArray(result.rows)).toBe(true);
      expect(typeof result.rowCount).toBe('number');
      expect(typeof result.executionTime).toBe('number');
    });

    it('should handle queries with no results', async () => {
      (executeReadOnlyQuery as jest.Mock).mockResolvedValue({
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 50,
      });

      const caller = settingsRouter.createCaller(ctx);

      const result = await caller.databases.executeQuery({
        query: 'SELECT * FROM "User" WHERE id = -999',
      });

      expect(result.rowCount).toBe(0);
      expect(result.rows).toEqual([]);
    });
  });

  describe('input validation', () => {
    it('should reject empty query strings', async () => {
      const caller = settingsRouter.createCaller(ctx);

      await expect(
        caller.databases.executeQuery({
          query: '',
        }),
      ).rejects.toThrow();
    });

    it('should accept queries with whitespace', async () => {
      const caller = settingsRouter.createCaller(ctx);

      await caller.databases.executeQuery({
        query: '  SELECT * FROM "User"  ',
      });

      expect(executeReadOnlyQuery).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should propagate DAL errors to caller', async () => {
      const dalError = new Error('Database connection timeout');
      (executeReadOnlyQuery as jest.Mock).mockRejectedValue(dalError);

      const caller = settingsRouter.createCaller(ctx);

      await expect(
        caller.databases.executeQuery({
          query: 'SELECT * FROM "User"',
        }),
      ).rejects.toThrow('Database connection timeout');
    });

    it('should handle unauthorized write attempts', async () => {
      (executeReadOnlyQuery as jest.Mock).mockRejectedValue(
        new Error('Failed to execute query: Only SELECT queries are allowed'),
      );

      const caller = settingsRouter.createCaller(ctx);

      await expect(
        caller.databases.executeQuery({
          query: 'UPDATE "User" SET name = "test"',
        }),
      ).rejects.toThrow('Failed to execute query: Only SELECT queries are allowed');

      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: AuditRecordOutcome.Error,
        }),
      );
    });
  });
});
