/**
 * @jest-environment node
 */
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/server/auth-adapter', () => ({ authOptions: async () => ({}) }));
jest.mock('@/server/storage/redis', () => ({
  storage: {
    hgetall: jest.fn(),
    lrange: jest.fn(),
  },
}));
jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { storage } from '@/server/storage/redis';
import handler from './[jobId]';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockHgetall = (storage as unknown as { hgetall: jest.Mock }).hgetall;
const mockLrange = (storage as unknown as { lrange: jest.Mock }).lrange;

type MockResponse = {
  statusCode: number;
  status: jest.Mock;
  end: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
  writeHead: jest.Mock;
  flushHeaders: jest.Mock;
  write: jest.Mock;
};

const buildResponse = (): MockResponse => {
  const res: MockResponse = {
    statusCode: 200,
    status: jest.fn(),
    end: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
    writeHead: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

const buildRequest = (overrides: Partial<{ method: string; query: Record<string, string> }> = {}): NextApiRequest => ({
  method: 'GET',
  query: { jobId: 'job-1' },
  on: jest.fn(),
  ...overrides,
} as unknown as NextApiRequest);

describe('GET /api/chat/stream/[jobId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof getServerSession>>);
  });

  it('rejects non-GET requests with 405', async () => {
    const req = buildRequest({ method: 'POST' });
    const res = buildResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalled();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = buildRequest();
    const res = buildResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('rejects requests with a non-string jobId with 400', async () => {
    const req = buildRequest({ query: { jobId: ['a', 'b'] } as unknown as Record<string, string> });
    const res = buildResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 after waiting 3 s when job never appears in Redis', async () => {
    jest.useFakeTimers();
    mockHgetall.mockResolvedValue(null);

    const req = buildRequest();
    const res = buildResponse();

    const handlerPromise = handler(req, res as unknown as NextApiResponse);

    await jest.runAllTimersAsync();
    await handlerPromise;

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Job not found' });

    jest.useRealTimers();
  });

  it('stops waiting early once the job appears in Redis', async () => {
    jest.useFakeTimers();
    // Return null for first 2 polls, then a valid job
    mockHgetall
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ status: 'processing' });
    // lrange returns done immediately so the stream closes
    mockLrange.mockResolvedValue([JSON.stringify({ t: 'done' })]);

    const req = buildRequest();
    const res = buildResponse();

    const endPromise = new Promise<void>(resolve => {
      (res.end as jest.Mock).mockImplementation(resolve);
    });

    void handler(req, res as unknown as NextApiResponse);

    await jest.runAllTimersAsync();
    await endPromise;

    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
    }));

    jest.useRealTimers();
  });

  it('writes SSE headers and forwards delta events then closes on done sentinel', async () => {
    mockHgetall.mockResolvedValue({ status: 'processing' });
    mockLrange.mockResolvedValue([
      JSON.stringify({ t: 'd', v: 'Hello' }),
      JSON.stringify({ t: 'done' }),
    ]);

    const req = buildRequest();
    const res = buildResponse();

    const endPromise = new Promise<void>(resolve => {
      (res.end as jest.Mock).mockImplementation(resolve);
    });

    void handler(req, res as unknown as NextApiResponse);

    await endPromise;

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
      'X-Accel-Buffering': 'no',
    }));
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('event: delta'),
    );
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"text":"Hello"'),
    );
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('event: done'),
    );
    expect(res.end).toHaveBeenCalled();
  });

  it('skips malformed JSON items without crashing', async () => {
    mockHgetall.mockResolvedValue({ status: 'processing' });
    mockLrange.mockResolvedValue([
      'not-valid-json',
      JSON.stringify({ t: 'done' }),
    ]);

    const req = buildRequest();
    const res = buildResponse();

    const endPromise = new Promise<void>(resolve => {
      (res.end as jest.Mock).mockImplementation(resolve);
    });

    void handler(req, res as unknown as NextApiResponse);

    await endPromise;

    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: done'));
    expect(res.end).toHaveBeenCalled();
  });
});
