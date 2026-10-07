import { trpc } from '@/libs';
import { ErrorRecordsQuery } from '@/features/shared/types/error-record';

export default function useGetErrorRecords(query: ErrorRecordsQuery, enabled: boolean = true) {
  return trpc.settings.getErrorRecords.useQuery(query, {
    enabled,
  });
}
