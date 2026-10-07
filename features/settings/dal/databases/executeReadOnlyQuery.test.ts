import executeReadOnlyQuery from './executeReadOnlyQuery';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe('executeReadOnlyQuery', () => {
  const mockTx = {
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.$executeRawUnsafe.mockResolvedValue(undefined);
    mockTx.$queryRawUnsafe.mockResolvedValue([]);
    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });
  });

  describe('successful query execution', () => {
    it('should execute a read-only query and return results', async () => {
      const mockRows = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ];

      mockTx.$queryRawUnsafe.mockResolvedValue(mockRows);

      const result = await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(result).toEqual({
        columns: ['id', 'name', 'email'],
        rows: mockRows,
        rowCount: 2,
        executionTime: expect.any(Number),
      });
    });

    it('should set transaction to read-only', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(mockTx.$executeRawUnsafe).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    });

    it('should set statement timeout', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(mockTx.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SET LOCAL statement_timeout'),
      );
    });

    it('should apply LIMIT to query', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 1000'),
      );
    });

    it('should trim query before adding LIMIT', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('  SELECT * FROM "User"  ');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith('SELECT * FROM "User" LIMIT 1000');
    });

    it('should handle queries with no results', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      const result = await executeReadOnlyQuery('SELECT * FROM "User" WHERE id = -999');

      expect(result).toEqual({
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: expect.any(Number),
      });
    });

    it('should extract column names from first row', async () => {
      const mockRows = [
        { id: 1, name: 'Alice', email: 'alice@example.com', role: 'Admin' },
      ];

      mockTx.$queryRawUnsafe.mockResolvedValue(mockRows);

      const result = await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(result.columns).toEqual(['id', 'name', 'email', 'role']);
    });

    it('should return empty columns array when no rows', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      const result = await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(result.columns).toEqual([]);
    });

    it('should calculate execution time', async () => {
      mockTx.$queryRawUnsafe.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return [];
      });

      const result = await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should pass transaction timeout option', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(db.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 30000 },
      );
    });
  });

  describe('error handling', () => {
    it('should log error and throw when query fails', async () => {
      const mockError = new Error('Database connection failed');
      mockTx.$queryRawUnsafe.mockRejectedValue(mockError);

      await expect(
        executeReadOnlyQuery('SELECT * FROM "User"'),
      ).rejects.toThrow('Failed to execute query: Database connection failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Error executing read-only query',
        expect.objectContaining({
          error: mockError,
          query: 'SELECT * FROM "User"',
        }),
      );
    });

    it('should handle timeout errors with custom message', async () => {
      const timeoutError = new Error('canceling statement due to statement timeout');
      mockTx.$queryRawUnsafe.mockRejectedValue(timeoutError);

      await expect(
        executeReadOnlyQuery('SELECT * FROM "User"'),
      ).rejects.toThrow('Query exceeded timeout limit of 30 seconds');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle transaction setup errors', async () => {
      mockTx.$executeRawUnsafe.mockRejectedValue(new Error('Cannot set read-only mode'));

      await expect(
        executeReadOnlyQuery('SELECT * FROM "User"'),
      ).rejects.toThrow('Failed to execute query: Cannot set read-only mode');
    });

    it('should throw error for invalid SQL syntax', async () => {
      mockTx.$queryRawUnsafe.mockRejectedValue(new Error('syntax error at or near "INVALID"'));

      await expect(
        executeReadOnlyQuery('SELECT * FROM INVALID'),
      ).rejects.toThrow('Failed to execute query: syntax error at or near "INVALID"');
    });

    it('should throw error when table does not exist', async () => {
      mockTx.$queryRawUnsafe.mockRejectedValue(new Error('relation "NonExistent" does not exist'));

      await expect(
        executeReadOnlyQuery('SELECT * FROM "NonExistent"'),
      ).rejects.toThrow('Failed to execute query: relation "NonExistent" does not exist');
    });
  });

  describe('row limit enforcement', () => {
    it('should limit results to 1000 rows', async () => {
      const mockRows = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 }));
      mockTx.$queryRawUnsafe.mockResolvedValue(mockRows);

      await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" LIMIT 1000',
      );
    });

    it('should append LIMIT even if query has WHERE clause', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User" WHERE role = \'Admin\'');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" WHERE role = \'Admin\' LIMIT 1000',
      );
    });

    it('should append LIMIT even if query has ORDER BY clause', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User" ORDER BY id DESC');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" ORDER BY id DESC LIMIT 1000',
      );
    });

    it('should not append LIMIT if query already has LIMIT', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User" LIMIT 10');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" LIMIT 10',
      );
    });

    it('should respect user limit with case variation', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User" limit 50');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" LIMIT 50',
      );
    });

    it('should not append LIMIT if query already has LIMIT with ORDER BY', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User" ORDER BY id DESC LIMIT 25');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" ORDER BY id DESC LIMIT 25',
      );
    });

    it('should enforce maximum limit when user specifies higher limit', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User" LIMIT 5000');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" LIMIT 1000',
      );
    });

    it('should respect user limit when lower than maximum', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User" LIMIT 100');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" LIMIT 100',
      );
    });

    it('should enforce maximum limit with case variation', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User" limit 2000');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" LIMIT 1000',
      );
    });

    it('should enforce maximum limit in complex query', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User" WHERE role = \'Admin\' ORDER BY id DESC LIMIT 3000');

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM "User" WHERE role = \'Admin\' ORDER BY id DESC LIMIT 1000',
      );
    });
  });

  describe('read-only enforcement', () => {
    it('should execute all setup commands in correct order', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(mockTx.$executeRawUnsafe).toHaveBeenNthCalledWith(1, 'SET TRANSACTION READ ONLY');
      expect(mockTx.$executeRawUnsafe).toHaveBeenNthCalledWith(
        2,
        'SET LOCAL statement_timeout = \'30000ms\'',
      );
    });

    it('should reject write operations via database-level read-only mode', async () => {
      mockTx.$queryRawUnsafe.mockRejectedValue(
        new Error('cannot execute UPDATE in a read-only transaction'),
      );

      await expect(
        executeReadOnlyQuery('UPDATE "User" SET name = \'test\''),
      ).rejects.toThrow('cannot execute UPDATE in a read-only transaction');
    });
  });

  describe('timeout handling', () => {
    it('should enforce 30 second timeout at transaction level', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User"');

      const transactionCall = (db.$transaction as jest.Mock).mock.calls[0];
      expect(transactionCall[1]).toEqual({ timeout: 30000 });
    });

    it('should set statement timeout to 30000ms', async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);

      await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(mockTx.$executeRawUnsafe).toHaveBeenCalledWith(
        'SET LOCAL statement_timeout = \'30000ms\'',
      );
    });
  });

  describe('complex queries', () => {
    it('should handle JOIN queries', async () => {
      const mockRows = [
        { userId: 1, userName: 'Alice', groupName: 'Admins' },
      ];
      mockTx.$queryRawUnsafe.mockResolvedValue(mockRows);

      const result = await executeReadOnlyQuery(
        'SELECT u.id as userId, u.name as userName, g.name as groupName FROM "User" u JOIN "Group" g ON u.groupId = g.id',
      );

      expect(result.columns).toEqual(['userId', 'userName', 'groupName']);
      expect(result.rowCount).toBe(1);
    });

    it('should handle aggregate queries', async () => {
      const mockRows = [{ count: 42 }];
      mockTx.$queryRawUnsafe.mockResolvedValue(mockRows);

      const result = await executeReadOnlyQuery('SELECT COUNT(*) as count FROM "User"');

      expect(result.columns).toEqual(['count']);
      expect(result.rows[0].count).toBe(42);
    });

    it('should handle queries with subqueries', async () => {
      const mockRows = [{ id: 1, name: 'Alice' }];
      mockTx.$queryRawUnsafe.mockResolvedValue(mockRows);

      const result = await executeReadOnlyQuery(
        'SELECT * FROM "User" WHERE id IN (SELECT userId FROM "Session" WHERE active = true)',
      );

      expect(result.rowCount).toBe(1);
    });
  });

  describe('column handling', () => {
    it('should handle different column types', async () => {
      const mockRows = [
        {
          id: 1,
          name: 'Alice',
          isActive: true,
          createdAt: new Date('2025-01-01'),
          metadata: { role: 'admin' },
        },
      ];
      mockTx.$queryRawUnsafe.mockResolvedValue(mockRows);

      const result = await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(result.columns).toEqual(['id', 'name', 'isActive', 'createdAt', 'metadata']);
      expect(result.rows[0]).toEqual(mockRows[0]);
    });

    it('should handle NULL values in results', async () => {
      const mockRows = [
        { id: 1, name: 'Alice', email: null },
      ];
      mockTx.$queryRawUnsafe.mockResolvedValue(mockRows);

      const result = await executeReadOnlyQuery('SELECT * FROM "User"');

      expect(result.rows[0].email).toBeNull();
    });

    it('should handle queries with column aliases', async () => {
      const mockRows = [
        { user_id: 1, user_name: 'Alice' },
      ];
      mockTx.$queryRawUnsafe.mockResolvedValue(mockRows);

      const result = await executeReadOnlyQuery(
        'SELECT id as user_id, name as user_name FROM "User"',
      );

      expect(result.columns).toEqual(['user_id', 'user_name']);
    });
  });
});
