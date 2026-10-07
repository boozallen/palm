import React from 'react';
import { render } from '@testing-library/react';
import GlobalErrorListener from './GlobalErrorListener';
import { reportClientError } from '@/features/shared/api/report-client-error';

jest.mock('@/features/shared/api/report-client-error', () => ({
  reportClientError: jest.fn(),
}));

describe('GlobalErrorListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports an uncaught window error', () => {
    render(<GlobalErrorListener />);

    const event = new ErrorEvent('error', { error: new Error('boom'), message: 'boom' });
    window.dispatchEvent(event);

    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'window-error',
      message: 'boom',
    }));
  });

  it('reports an unhandled promise rejection', () => {
    render(<GlobalErrorListener />);

    const event = new Event('unhandledrejection') as unknown as PromiseRejectionEvent & { reason: unknown };
    (event as { reason: unknown }).reason = new Error('promise failed');
    window.dispatchEvent(event as Event);

    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'unhandled-rejection',
      message: 'promise failed',
    }));
  });

  it('handles a non-Error rejection reason', () => {
    render(<GlobalErrorListener />);

    const event = new Event('unhandledrejection') as unknown as PromiseRejectionEvent & { reason: unknown };
    (event as { reason: unknown }).reason = 'a string rejection';
    window.dispatchEvent(event as Event);

    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'unhandled-rejection',
      message: 'a string rejection',
      stack: undefined,
    }));
  });

  it('removes its listeners on unmount', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(<GlobalErrorListener />);
    unmount();

    const addedTypes = addSpy.mock.calls.map(([type]) => type);
    const removedTypes = removeSpy.mock.calls.map(([type]) => type);
    expect(addedTypes).toEqual(expect.arrayContaining(['error', 'unhandledrejection']));
    expect(removedTypes).toEqual(expect.arrayContaining(['error', 'unhandledrejection']));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
