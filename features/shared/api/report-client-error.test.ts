describe('reportClientError', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('posts the report to the client-errors endpoint', async () => {
    const { reportClientError } = require('./report-client-error');

    reportClientError({ kind: 'window-error', message: 'boom', stack: 'Error: boom' });

    expect(global.fetch).toHaveBeenCalledWith('/api/client-errors', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toMatchObject({ kind: 'window-error', message: 'boom', stack: 'Error: boom' });
  });

  it('de-dupes the same kind/message within a session', () => {
    const { reportClientError } = require('./report-client-error');

    reportClientError({ kind: 'window-error', message: 'boom' });
    reportClientError({ kind: 'window-error', message: 'boom' });
    reportClientError({ kind: 'window-error', message: 'boom' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports distinct kind/message combinations separately', () => {
    const { reportClientError } = require('./report-client-error');

    reportClientError({ kind: 'window-error', message: 'boom' });
    reportClientError({ kind: 'unhandled-rejection', message: 'boom' });
    reportClientError({ kind: 'window-error', message: 'a different failure' });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('stops reporting once the per-session cap is hit', () => {
    const { reportClientError } = require('./report-client-error');

    for (let i = 0; i < 25; i += 1) {
      reportClientError({ kind: 'window-error', message: `failure ${i}` });
    }

    expect(global.fetch).toHaveBeenCalledTimes(20);
  });

  it('swallows a failed fetch rather than throwing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const { reportClientError } = require('./report-client-error');

    expect(() => reportClientError({ kind: 'window-error', message: 'boom' })).not.toThrow();
  });
});
