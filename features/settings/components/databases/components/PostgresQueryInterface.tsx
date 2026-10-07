import { useState } from 'react';
import {
  Stack,
  Textarea,
  Button,
  Paper,
  Title,
  Text,
  Table,
  ScrollArea,
  Badge,
  Group,
  Box,
  Alert,
} from '@mantine/core';
import { IconDatabase, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import useExecuteQuery from '@/features/settings/api/databases/execute-query';

export default function PostgresQueryInterface() {
  const [query, setQuery] = useState('');
  const executeQueryMutation = useExecuteQuery();

  const validateQuery = (query: string): { valid: boolean; error?: string } => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      return { valid: false, error: 'Please enter a query' };
    }

    // Must start with SELECT
    if (!trimmedQuery.startsWith('select')) {
      return { valid: false, error: 'Only SELECT queries are allowed' };
    }

    // Check for disallowed keywords using word boundaries
    const disallowedKeywords = [
      'insert', 'update', 'delete', 'drop', 'create', 'alter',
      'truncate', 'grant', 'revoke', 'execute', 'exec',
    ];

    for (const keyword of disallowedKeywords) {
      // Use word boundary regex to match whole words only
      const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (keywordRegex.test(trimmedQuery)) {
        return {
          valid: false,
          error: `Query contains disallowed keyword: ${keyword.toUpperCase()}. Only SELECT queries are permitted.`,
        };
      }
    }

    return { valid: true };
  };

  const handleExecuteQuery = async () => {
    const validation = validateQuery(query);

    if (!validation.valid) {
      notifications.show({
        title: 'Invalid Query',
        message: validation.error,
        color: 'red',
      });
      return;
    }

    try {
      await executeQueryMutation.mutateAsync({ query });
      notifications.show({
        title: 'Success',
        message: 'Query executed successfully',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: (error as Error).message,
        color: 'red',
      });
    }
  };

  const { data, isPending } = executeQueryMutation;

  return (
    <Stack spacing='md'>
      <Paper p='md' bg='dark.6'>
        <Stack spacing='md'>
          <Group position='apart'>
            <Title order={3} color='gray.1'>
              Query Editor
            </Title>
            <Badge color='yellow' leftSection={<IconAlertCircle size={14} />}>
              Read-Only
            </Badge>
          </Group>

          <Alert color='blue' icon={<IconDatabase size={16} />}>
            Only SELECT queries are allowed. All queries are logged via audit records.
          </Alert>

          <Textarea
            placeholder='SELECT * FROM "User" LIMIT 10;'
            minRows={6}
            maxRows={12}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: '14px',
              },
            }}
          />

          <Group position='apart'>
            <Button
              onClick={handleExecuteQuery}
              loading={isPending}
              leftIcon={<IconDatabase size={16} />}
              variant='filled'
            >
              Execute Query
            </Button>
            {data && (
              <Text size='sm' color='dimmed'>
                {data.rowCount} row{data.rowCount !== 1 ? 's' : ''} returned in {data.executionTime}ms
              </Text>
            )}
          </Group>
        </Stack>
      </Paper>

      {data && data.rows.length > 0 && (
        <Paper p='md' bg='dark.6'>
          <Stack spacing='md'>
            <Title order={3} color='gray.1'>
              Results
            </Title>

            <ScrollArea>
              <Box style={{ minWidth: '800px' }}>
                <Table striped highlightOnHover>
                  <thead>
                    <tr>
                      {data.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, index) => (
                      <tr key={index}>
                        {data.columns.map((column) => (
                          <td key={column}>
                            {row[column] === null
                              ? <Text color='dimmed' italic>NULL</Text>
                              : typeof row[column] === 'object'
                              ? JSON.stringify(row[column])
                              : String(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Box>
            </ScrollArea>
          </Stack>
        </Paper>
      )}

      {data && data.rows.length === 0 && (
        <Paper p='md' bg='dark.6'>
          <Text color='dimmed' align='center'>
            Query returned no results
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
