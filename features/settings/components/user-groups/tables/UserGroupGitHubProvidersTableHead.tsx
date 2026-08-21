import { Flex } from '@mantine/core';

export default function UserGroupGitHubProvidersTableHead() {

  return (
    <thead>
    <tr>
      <th>GitHub Provider</th>
      <th>
        <Flex justify='center'>
          Enabled
        </Flex>
      </th>
    </tr>
  </thead>
  );
}
