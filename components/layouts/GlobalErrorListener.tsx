import { useEffect } from 'react';
import { reportClientError } from '@/features/shared/api/report-client-error';

// Catches errors AppErrorBoundary can't: those thrown outside the
// render/lifecycle path (event handlers, timers) and unhandled promise
// rejections. Reports to the same endpoint.
export default function GlobalErrorListener() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reportClientError({
        kind: 'window-error',
        message: event.error?.message ?? event.message,
        stack: event.error?.stack,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const { reason } = event;
      reportClientError({
        kind: 'unhandled-rejection',
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
