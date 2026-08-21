import { Flex } from '@mantine/core';

export default function UserGroupGraphDatabasesTableHead() {
  return (
    <thead>
      <tr>
        <th>Graph Database Feature</th>
        <th>
          <Flex justify='center'>
            Enabled
          </Flex>
        </th>
      </tr>
    </thead>
  );
}