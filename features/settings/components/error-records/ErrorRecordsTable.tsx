import React from 'react';
import { Pagination, Stack, Table, Text, Badge, Loader, Center, Spoiler } from '@mantine/core';
import { ErrorRecordResult, formatErrorRecordCode } from '@/features/shared/types/error-record';

type ErrorRecordsTableProps = Readonly<{
  records: ErrorRecordResult[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  isSubmitted: boolean;
}>;

const codeColors: Record<string, string> = {
  INTERNAL_SERVER_ERROR: 'red',
  TIMEOUT: 'red',
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

export default function ErrorRecordsTable({
  records,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  isLoading,
  isSubmitted,
}: ErrorRecordsTableProps) {
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
        No error records found
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
              <th>Source</th>
              <th>Route</th>
              <th>Code</th>
              <th>Message</th>
              <th>Stack</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record: ErrorRecordResult) => (
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
                  <Text size='sm'>{record.source}</Text>
                </td>
                <td>
                  <Text size='sm' color='gray.6'>
                    {record.route ?? '-'}
                  </Text>
                </td>
                <td>
                  <Badge color={codeColors[record.code] ?? 'yellow'} variant='filled' c='black'>
                    {formatErrorRecordCode(record.code)}
                  </Badge>
                </td>
                <td>
                  <Spoiler maxHeight={40} showLabel='Show more' hideLabel='Show less'>
                    <Text size='sm'>{record.message}</Text>
                  </Spoiler>
                </td>
                <td>
                  <Spoiler maxHeight={40} showLabel='Show more' hideLabel='Show less'>
                    <Text size='xs' color='gray.6' sx={{ whiteSpace: 'pre-wrap' }}>
                      {record.stack ?? '-'}
                    </Text>
                  </Spoiler>
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
