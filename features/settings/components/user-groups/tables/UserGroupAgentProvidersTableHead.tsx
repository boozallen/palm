import { Flex } from '@mantine/core';

export default function UserGroupAgentProvidersTableHead() {

  return (
    <thead>
    <tr>
      <th>Agent Provider</th>
      <th>
        <Flex justify='center'>
          Enabled
        </Flex>
      </th>
    </tr>
  </thead>
  );
}
