import { Flex } from '@mantine/core';

export default function UserGroupAiProvidersTableHead() {

  return (
    <thead>
    <tr>
      <th>AI Provider</th>
      <th>
        <Flex justify='center'>
          Enabled
        </Flex>
      </th>
    </tr>
  </thead>
  );
}
