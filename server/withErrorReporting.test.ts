import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { TRPCError } from '@trpc/server';
import { ZodError, z } from 'zod';

import { withErrorReporting } from './withErrorReporting';
import { createErrorAuditor } from '@/server/errorAuditor';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));

// The real auth-adapter pulls in jose's ESM browser build, which this Jest
// transform cannot parse. The handler only calls authOptions() and forwards
// its result to getServerSession, which is mocked, so a stub is sufficient.
jest.mock('@/server/auth-adapter', () => ({ authOptions: async () => ({}) }));

jest.mock('@/server/errorAuditor', () => ({
  createErrorAuditor: jest.fn(),
}));

describe('withErrorReporting', () => {
  const mockUserId = '5b0f0f2e-4d21-4a8f-9c3b-0d1f2a3b4c5d';
  const createErrorRecord = jest.fn();

  type MockResponse = NextApiResponse & { statusCode?: number; jsonBody?: unknown };

  const buildResponse = (headersSent = false): MockResponse => {
    const res = { headersSent } as MockResponse;
    res.status = jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }) as unknown as MockResponse['status'];
    res.json = jest.fn((body: unknown) => {
      res.jsonBody = body;
      return res;
    }) as unknown as MockResponse['json'];
    return res;
  };

  const buildRequest = (): NextApiRequest => ({
    method: 'POST',
    url: '/api/reports/error-records',
  } as unknown as NextApiRequest);

  beforeEach(() => {
    jest.clearAllMocks();
    (createErrorAuditor as jest.Mock).mockReturnValue({ createErrorRecord });
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: mockUserId } });
  });

  it('passes success through without writing an ErrorRecord', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const res = buildResponse();

    await withErrorReporting(handler)(buildRequest(), res);

    expect(res.status).not.toHaveBeenCalled();
    expect(createErrorRecord).not.toHaveBeenCalled();
  });

  it('maps a TRPCError to its real HTTP status and records it', async () => {
    const handler = jest.fn().mockRejectedValue(new TRPCError({ code: 'FORBIDDEN', message: 'nope' }));
    const res = buildResponse();

    await withErrorReporting(handler)(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'nope' });
    expect(createErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
      source: 'rest-api',
      route: '/api/reports/error-records',
      code: 'FORBIDDEN',
      message: 'nope',
    }));
  });

  it('maps a ZodError to a 400 BAD_REQUEST', async () => {
    const zodError = z.object({ id: z.string() }).safeParse({}).error as ZodError;
    const handler = jest.fn().mockRejectedValue(zodError);
    const res = buildResponse();

    await withErrorReporting(handler)(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createErrorRecord).toHaveBeenCalledWith(expect.objectContaining({ code: 'BAD_REQUEST' }));
  });

  it('maps a plain Error to a 500 INTERNAL_SERVER_ERROR', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const res = buildResponse();

    await withErrorReporting(handler)(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(createErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'boom',
    }));
  });

  it('attributes the error to no user when there is no session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const handler = jest.fn().mockRejectedValue(new Error('boom'));

    await withErrorReporting(handler)(buildRequest(), buildResponse());

    expect(createErrorAuditor).toHaveBeenCalledWith({ userId: null });
  });

  it('never throws even if session lookup itself fails', async () => {
    (getServerSession as jest.Mock).mockRejectedValue(new Error('session lookup failed'));
    const handler = jest.fn().mockRejectedValue(new Error('boom'));

    await withErrorReporting(handler)(buildRequest(), buildResponse());

    expect(createErrorAuditor).toHaveBeenCalledWith({ userId: null });
  });

  it('prefers a custom resolveUserId over session lookup', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const resolveUserId = jest.fn().mockReturnValue('internal-caller-id');

    await withErrorReporting(handler, { resolveUserId })(buildRequest(), buildResponse());

    expect(resolveUserId).toHaveBeenCalled();
    expect(getServerSession).not.toHaveBeenCalled();
    expect(createErrorAuditor).toHaveBeenCalledWith({ userId: 'internal-caller-id' });
  });

  it('does not write a response once headers have already been sent', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const res = buildResponse(true);

    await withErrorReporting(handler)(buildRequest(), res);

    expect(res.status).not.toHaveBeenCalled();
    expect(createErrorRecord).toHaveBeenCalled();
  });
});
