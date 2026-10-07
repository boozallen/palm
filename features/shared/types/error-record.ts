import { z } from 'zod';

// Discriminator for which layer caught the error.
export enum ErrorRecordSource {
  Trpc = 'trpc',
  RestApi = 'rest-api',
  BackgroundJob = 'background-job',
  Frontend = 'frontend',
}

export const ErrorRecordSourceLabels: Record<ErrorRecordSource, string> = {
  [ErrorRecordSource.Trpc]: 'tRPC',
  [ErrorRecordSource.RestApi]: 'REST API',
  [ErrorRecordSource.BackgroundJob]: 'Background Job',
  [ErrorRecordSource.Frontend]: 'Frontend',
};

// Mirrors @trpc/server's TRPCError codes. Kept as a plain string column, not a
// Prisma enum, since the set of codes is owned by tRPC, not us.
export const ERROR_RECORD_CODES = [
  'PARSE_ERROR',
  'BAD_REQUEST',
  'INTERNAL_SERVER_ERROR',
  'NOT_IMPLEMENTED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_SUPPORTED',
  'TIMEOUT',
  'CONFLICT',
  'PRECONDITION_FAILED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNPROCESSABLE_CONTENT',
  'TOO_MANY_REQUESTS',
  'CLIENT_CLOSED_REQUEST',
  // Non-tRPC codes, for the background-job, frontend, and auth sources.
  'JOB_FAILED',
  'REACT_RENDER_ERROR',
  'WINDOW_ERROR',
  'UNHANDLED_REJECTION',
  'AUTH_ERROR',
] as const;

export function formatErrorRecordCode(code: string): string {
  return code
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export const ErrorRecordSourceOptions = [
  { value: '', label: 'All Sources' },
  ...Object.entries(ErrorRecordSourceLabels).map(([value, label]) => ({ value, label })),
];

export const ErrorRecordCodeOptions = [
  { value: '', label: 'All Codes' },
  ...ERROR_RECORD_CODES.map((code) => ({ value: code, label: formatErrorRecordCode(code) })),
];

export type ErrorRecordResult = {
  id: string;
  userName: string | null;
  userEmail: string | null;
  source: string;
  route: string | null;
  code: string;
  message: string;
  stack: string | null;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
};

export type ErrorRecordsQueryResult = {
  records: ErrorRecordResult[];
  totalCount: number;
};

export const errorRecordsQuery = z.object({
  source: z.string().optional(),
  code: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

export type ErrorRecordsQuery = z.infer<typeof errorRecordsQuery>;

export const errorRecordsInitialValues: ErrorRecordsQuery = {
  source: undefined,
  code: undefined,
  search: undefined,
  page: 1,
  pageSize: 20,
};
