import { Flex } from '@mantine/core';

export default function UserGroupContextStudioTableHead() {
  return (
    <thead>
      <tr>
        <th>Context Studio Feature</th>
        <th>
          <Flex justify='center'>
            Enabled
          </Flex>
        </th>
      </tr>
    </thead>
  );
}
