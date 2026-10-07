import React from 'react';
import { Pagination, Stack, Table, Text, Badge, Loader, Center, Spoiler } from '@mantine/core';
import { AuditRecordResult } from '@/features/shared/types/audit-record';
import { summarizeAuditRecordMetadata } from '@/features/shared/utils/auditRecordMetadata';

type AuditRecordsTableProps = Readonly<{
  records: AuditRecordResult[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  isSubmitted: boolean;
}>;

const outcomeColors: Record<string, string> = {
  SUCCESS: 'green',
  ERROR: 'red',
  WARN: 'yellow',
  INFO: 'blue',
};

const formatEventName = (event: string): string => {
  return event
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

const formatTimestamp = (timestamp: Date): string => {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
};

export default function AuditRecordsTable({
  records,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  isLoading,
  isSubmitted,
}: AuditRecordsTableProps) {
  if (isLoading) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  if (!isSubmitted) {
    return null;
  }

  if (!records || records.length === 0) {
    return (
      <Text color='gray.6' fz='md'>
        No audit records found
      </Text>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Stack spacing='lg'>
      <Stack bg='dark.6' p='md' spacing='md'>
        <Text size='sm' color='gray.6'>
          {totalCount} total record{totalCount !== 1 ? 's' : ''}
        </Text>
        <Table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Event</th>
              <th>Outcome</th>
              <th>Description</th>
              <th>Resource</th>
              <th>Referer</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record: AuditRecordResult) => (
              <tr key={record.id}>
                <td>
                  <Text size='sm'>{formatTimestamp(record.timestamp)}</Text>
                </td>
                <td>
                  <Stack spacing='xxs'>
                    <Text size='sm' fw='bold'>
                      {record.userName ?? 'System'}
                    </Text>
                    {record.userEmail && (
                      <Text size='xs' color='gray.6'>
                        {record.userEmail}
                      </Text>
                    )}
                  </Stack>
                </td>
                <td>
                  <Text size='sm'>{formatEventName(record.event)}</Text>
                </td>
                <td>
                  <Badge color={outcomeColors[record.outcome] ?? 'gray'} variant='filled' c='black'>
                    {record.outcome}
                  </Badge>
                </td>
                <td>
                  <Spoiler maxHeight={40} showLabel='Show more' hideLabel='Show less'>
                    <Text size='sm'>{record.description}</Text>
                  </Spoiler>
                </td>
                <td>
                  <Spoiler maxHeight={40} showLabel='Show more' hideLabel='Show less'>
                    <Text size='sm' color='gray.6'>
                      {summarizeAuditRecordMetadata(record.metadata) || '-'}
                    </Text>
                  </Spoiler>
                </td>
                <td>
                  <Text size='sm' color='gray.6'>
                    {record.referer ?? '-'}
                  </Text>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Stack>
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={onPageChange}
          position='right'
        />
      )}
    </Stack>
  );
}
