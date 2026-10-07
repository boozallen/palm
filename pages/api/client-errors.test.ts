import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import recordClientError from './client-errors';
import { createErrorAuditor } from '@/server/errorAuditor';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));

// The real auth-adapter pulls in jose's ESM browser build, which this Jest
// transform cannot parse. The handler only calls authOptions() and forwards
// its result to getServerSession, which is mocked, so a stub is sufficient.
jest.mock('@/server/auth-adapter', () => ({ authOptions: async () => ({}) }));

jest.mock('@/server/errorAuditor', () => ({
  createErrorAuditor: jest.fn(),
}));

describe('recordClientError', () => {
  const mockUserId = '5b0f0f2e-4d21-4a8f-9c3b-0d1f2a3b4c5d';
  const createErrorRecord = jest.fn();

  type MockResponse = NextApiResponse & { statusCode?: number; headers: Record<string, string> };

  const buildResponse = (): MockResponse => {
    const res = { headers: {} } as MockResponse;
    res.status = jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }) as unknown as MockResponse['status'];
    res.setHeader = jest.fn((name: string, value: string) => {
      res.headers[name] = value;
      return res;
    }) as unknown as MockResponse['setHeader'];
    res.end = jest.fn() as unknown as MockResponse['end'];
    return res;
  };

  const buildRequest = (body: unknown, method = 'POST'): NextApiRequest =>
    ({ method, body } as unknown as NextApiRequest);

  beforeEach(() => {
    jest.clearAllMocks();
    (createErrorAuditor as jest.Mock).mockReturnValue({ createErrorRecord });
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: mockUserId } });
  });

  it('records a valid report against the signed-in user and responds 204', async () => {
    const res = buildResponse();

    await recordClientError(buildRequest({
      kind: 'react-render',
      message: 'Cannot read properties of undefined',
      stack: 'Error: ...\n    at Component',
      componentStack: 'at Component\n    at AppErrorBoundary',
      url: '/context-studio',
    }), res);

    expect(createErrorAuditor).toHaveBeenCalledWith({ userId: mockUserId });
    expect(createErrorRecord).toHaveBeenCalledWith({
      source: 'frontend',
      route: '/context-studio',
      code: 'REACT_RENDER_ERROR',
      message: 'Cannot read properties of undefined',
      stack: 'Error: ...\n    at Component',
      metadata: { componentStack: 'at Component\n    at AppErrorBoundary' },
    });
    expect(res.statusCode).toBe(204);
  });

  it('attributes the report to no user when there is no session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = buildResponse();

    await recordClientError(buildRequest({ kind: 'window-error', message: 'boom' }), res);

    expect(createErrorAuditor).toHaveBeenCalledWith({ userId: null });
    expect(res.statusCode).toBe(204);
  });

  it('still responds 204 when the session lookup itself fails', async () => {
    (getServerSession as jest.Mock).mockRejectedValue(new Error('session lookup failed'));
    const res = buildResponse();

    await recordClientError(buildRequest({ kind: 'unhandled-rejection', message: 'boom' }), res);

    expect(createErrorAuditor).toHaveBeenCalledWith({ userId: null });
    expect(res.statusCode).toBe(204);
  });

  it('drops a malformed body without writing an ErrorRecord', async () => {
    const res = buildResponse();

    await recordClientError(buildRequest({ kind: 'not-a-real-kind', message: 'boom' }), res);

    expect(createErrorAuditor).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
  });

  it('rejects non-POST methods', async () => {
    const res = buildResponse();

    await recordClientError(buildRequest(undefined, 'GET'), res);

    expect(res.statusCode).toBe(405);
    expect(createErrorAuditor).not.toHaveBeenCalled();
  });
});
