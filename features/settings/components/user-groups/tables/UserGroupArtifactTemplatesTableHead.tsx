import { Flex } from '@mantine/core';

export default function UserGroupArtifactTemplatesTableHead() {
  return (
    <thead>
      <tr>
        <th>Template</th>
        <th>
          <Flex justify='center'>
            Enabled
          </Flex>
        </th>
      </tr>
    </thead>
  );
}
