import { trpc } from '@/libs';
import { AuditRecordsQuery } from '@/features/shared/types/audit-record';

export default function useGetAuditRecords(query: AuditRecordsQuery, enabled: boolean = true) {
  return trpc.settings.getAuditRecords.useQuery(query, {
    enabled,
  });
}
