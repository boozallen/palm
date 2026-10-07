import getDocumentLineage from './getDocumentLineage';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    document: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe('getDocumentLineage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return depth 0 for an original document with no lineage', async () => {
    const mockDocument = {
      userId: 'user-1',
      user: {
        name: 'Alice',
        email: 'alice@example.com',
        userGroupMemberhip: [],
      },
      copiedFromAction: null,
      adminDocumentGroups: [],
    };

    (db.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);

    const result = await getDocumentLineage('doc-1');

    expect(result).toEqual({
      depth: 0,
      chain: [
        {
          userId: 'user-1',
          userName: 'Alice',
          userEmail: 'alice@example.com',
          userGroupIds: [],
        },
      ],
    });
  });

  it('should return depth 1 for a first-generation copy', async () => {
    const mockCopiedDocument = {
      userId: 'user-2',
      user: {
        name: 'Bob',
        email: 'bob@example.com',
        userGroupMemberhip: [{ userGroupId: 'group-1' }],
      },
      copiedFromAction: {
        sharedDocument: {
          sourceDocumentId: 'doc-source',
        },
      },
      adminDocumentGroups: [{ userGroupId: 'group-1' }],
    };

    const mockSourceDocument = {
      userId: 'user-1',
      user: {
        name: 'Alice',
        email: 'alice@example.com',
        userGroupMemberhip: [],
      },
      copiedFromAction: null,
      adminDocumentGroups: [],
    };

    (db.document.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockCopiedDocument)
      .mockResolvedValueOnce(mockSourceDocument);

    const result = await getDocumentLineage('doc-copy');

    expect(result).toEqual({
      depth: 1,
      chain: [
        {
          userId: 'user-1',
          userName: 'Alice',
          userEmail: 'alice@example.com',
          userGroupIds: [],
        },
        {
          userId: 'user-2',
          userName: 'Bob',
          userEmail: 'bob@example.com',
          userGroupIds: ['group-1'],
        },
      ],
    });
  });

  it('should return depth 2 for a second-generation copy', async () => {
    const mockThirdGenDocument = {
      userId: 'user-3',
      user: {
        name: 'Charlie',
        email: 'charlie@example.com',
        userGroupMemberhip: [{ userGroupId: 'group-2' }, { userGroupId: 'group-3' }],
      },
      copiedFromAction: {
        sharedDocument: {
          sourceDocumentId: 'doc-second-gen',
        },
      },
      adminDocumentGroups: [{ userGroupId: 'group-2' }, { userGroupId: 'group-3' }],
    };

    const mockSecondGenDocument = {
      userId: 'user-2',
      user: {
        name: 'Bob',
        email: 'bob@example.com',
        userGroupMemberhip: [{ userGroupId: 'group-1' }],
      },
      copiedFromAction: {
        sharedDocument: {
          sourceDocumentId: 'doc-original',
        },
      },
      adminDocumentGroups: [{ userGroupId: 'group-1' }],
    };

    const mockOriginalDocument = {
      userId: 'user-1',
      user: {
        name: 'Alice',
        email: null,
        userGroupMemberhip: [],
      },
      copiedFromAction: null,
      adminDocumentGroups: [],
    };

    (db.document.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockThirdGenDocument)
      .mockResolvedValueOnce(mockSecondGenDocument)
      .mockResolvedValueOnce(mockOriginalDocument);

    const result = await getDocumentLineage('doc-third-gen');

    expect(result).toEqual({
      depth: 2,
      chain: [
        {
          userId: 'user-1',
          userName: 'Alice',
          userEmail: undefined,
          userGroupIds: [],
        },
        {
          userId: 'user-2',
          userName: 'Bob',
          userEmail: 'bob@example.com',
          userGroupIds: ['group-1'],
        },
        {
          userId: 'user-3',
          userName: 'Charlie',
          userEmail: 'charlie@example.com',
          userGroupIds: ['group-2', 'group-3'],
        },
      ],
    });
  });

  it('should handle null email addresses', async () => {
    const mockDocument = {
      userId: 'user-1',
      user: {
        name: 'Alice',
        email: null,
        userGroupMemberhip: [],
      },
      copiedFromAction: null,
      adminDocumentGroups: [],
    };

    (db.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);

    const result = await getDocumentLineage('doc-1');

    expect(result.chain[0].userEmail).toBeUndefined();
  });

  it('should throw an error if document lookup fails', async () => {
    (db.document.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

    await expect(getDocumentLineage('doc-1')).rejects.toThrow('Error getting document lineage');
  });
});
