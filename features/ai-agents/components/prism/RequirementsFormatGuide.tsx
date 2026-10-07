import { Table, Paper, Text, Stack, Badge, Group, Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

export default function RequirementsFormatGuide() {
  return (
    <Stack spacing='xs'>
      <Text size='sm'>Your spreadsheet must follow this column structure:</Text>
      <Paper p='md' withBorder>
        <Table fontSize='sm'>
          <thead>
            <tr>
              <th>
                <Group spacing='xs'>
                  Requirement
                  <Badge size='xs' color='red'>Required</Badge>
                </Group>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Text size='xs' c='gray.6' fs='italic'>
                  The system shall support a minimum of 1,000 concurrent users.
                </Text>
              </td>
            </tr>
          </tbody>
        </Table>
      </Paper>
      <Alert icon={<IconInfoCircle size={16} />} color='blue' variant='light' p='xs'>
        <Text size='xs'>
          One column must be named <em>Requirement</em>. Other columns are allowed and will be ignored.
          Spreadsheet tabs are optional — if multiple tabs are present, each tab name will be used as a
          category to group results.
        </Text>
      </Alert>
    </Stack>
  );
}
