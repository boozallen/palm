/**
 * @jest-environment node
 */
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/server/auth-adapter', () => ({ authOptions: async () => ({}) }));
jest.mock('@/server/logger', () => {
  const stub = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { __esModule: true, logger: stub, default: stub };
});
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    auditRecord: { create: jest.fn() },
  },
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import db from '@/server/db';
import handler from './download';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockQueryRaw = (db as unknown as { $queryRaw: jest.Mock }).$queryRaw;
const mockAuditRecordCreate = (db as unknown as { auditRecord: { create: jest.Mock } }).auditRecord.create;

type MockResponse = {
  statusCode: number;
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
  end: jest.Mock;
};

const buildResponse = (): MockResponse => {
  const res: MockResponse = {
    statusCode: 200,
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
    end: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.setHeader.mockReturnValue(res);
  return res;
};

const buildRequest = (artifactId = 'artifact-1'): NextApiRequest => ({
  method: 'GET',
  query: { id: artifactId },
  headers: {},
} as unknown as NextApiRequest);

describe('GET /api/chat/artifacts/download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockAuditRecordCreate.mockResolvedValue({ id: 'audit-1' });
  });

  it('returns 404 and records a failed audit instead of a 0-byte success when the artifact has no binary or text content', async () => {
    mockQueryRaw.mockResolvedValue([{
      binaryContent: null,
      content: '',
      githubUrl: null,
      fileExtension: '.txt',
      label: 'Empty artifact',
      chatMessageId: 'message-1',
      chatId: 'chat-1',
    }]);

    const res = buildResponse();
    await handler(buildRequest(), res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.end).not.toHaveBeenCalled();
    expect(mockAuditRecordCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ outcome: 'ERROR' }),
    }));
  });

  it('serves the artifact and records a success audit when content is present', async () => {
    mockQueryRaw.mockResolvedValue([{
      binaryContent: null,
      content: 'hello world',
      githubUrl: null,
      fileExtension: '.txt',
      label: 'Notes',
      chatMessageId: 'message-1',
      chatId: 'chat-1',
    }]);

    const res = buildResponse();
    await handler(buildRequest(), res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
    expect(mockAuditRecordCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ outcome: 'SUCCESS' }),
    }));
  });
});
