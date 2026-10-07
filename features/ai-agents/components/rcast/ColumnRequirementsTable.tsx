import { Table, Paper, Text, Stack, Badge, Tooltip, Group } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

export default function ColumnRequirementsTable() {
  return (
    <Stack spacing='md'>
      <Paper p='md' withBorder>
        <Table fontSize='sm'>
          <thead>
            <tr>
              <th>
                <Group spacing='xs'>
                  Labor Category
                  <Tooltip label='Labor Category is required' withArrow>
                    <Badge size='xs' color='red'>Required</Badge>
                  </Tooltip>
                </Group>
              </th>
              <th>
                <Group spacing='xs'>
                  Experience Level
                  <Tooltip label='Experience Level is required' withArrow>
                    <Badge size='xs' color='red'>Required</Badge>
                  </Tooltip>
                </Group>
              </th>
              <th>
                <Group spacing='xs'>
                  Rate
                  <Tooltip
                    label='Fully loaded bill rate including all fees. Accepts currency symbols and comma separators (e.g. $150.00)'
                    withArrow
                    multiline
                    width={280}
                  >
                    <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-gray-5)' }} />
                  </Tooltip>
                  <Tooltip label='Rate is required' withArrow>
                    <Badge size='xs' color='red'>Required</Badge>
                  </Tooltip>
                </Group>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Text size='xs' c='gray.6' fs='italic'>
                  Software Engineer
                </Text>
              </td>
              <td>
                <Text size='xs' c='gray.6' fs='italic'>
                  Senior
                </Text>
              </td>
              <td>
                <Text size='xs' c='gray.6' fs='italic'>
                  $150.00
                </Text>
              </td>
            </tr>
          </tbody>
        </Table>
      </Paper>
    </Stack>
  );
}
