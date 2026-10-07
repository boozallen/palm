export type ClientErrorKind = 'react-render' | 'window-error' | 'unhandled-rejection';

export interface ClientErrorReport {
  kind: ClientErrorKind;
  message: string;
  stack?: string;
  componentStack?: string;
}

const MAX_REPORTS_PER_SESSION = 20;
const reportedKeys = new Set<string>();
let reportCount = 0;

// Fire-and-forget POST to the frontend error-recording chokepoint
// (pages/api/client-errors.ts), used by both AppErrorBoundary and
// GlobalErrorListener. De-duped and capped per tab: a render/retry loop
// throwing the same error repeatedly must not flood the endpoint, and this
// repo has no server-side rate limiting to fall back on.
export function reportClientError(report: ClientErrorReport): void {
  const key = `${report.kind}:${report.message}`;
  if (reportedKeys.has(key) || reportCount >= MAX_REPORTS_PER_SESSION) {
    return;
  }
  reportedKeys.add(key);
  reportCount += 1;

  fetch('/api/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...report,
      url: typeof window !== 'undefined' ? window.location.pathname : undefined,
    }),
  }).catch(() => {
    // Best-effort telemetry; a failed report must never surface to the user.
  });
}
