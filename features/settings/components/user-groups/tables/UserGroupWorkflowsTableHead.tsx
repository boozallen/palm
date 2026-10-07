import { Flex } from '@mantine/core';

export default function UserGroupWorkflowsTableHead() {
  return (
    <thead>
      <tr>
        <th>Workflows Feature</th>
        <th>
          <Flex justify='center'>
            Enabled
          </Flex>
        </th>
      </tr>
    </thead>
  );
}