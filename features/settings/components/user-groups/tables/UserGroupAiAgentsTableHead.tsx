import { Flex } from '@mantine/core';

export default function UserGroupAiAgentsTableHead() {
  return (
    <thead>
      <tr>
        <th>AI Agent</th>
        <th>Requirements</th>
        <th>
          <Flex justify='center'>Enabled</Flex>
        </th>
      </tr>
    </thead>
  );
}
