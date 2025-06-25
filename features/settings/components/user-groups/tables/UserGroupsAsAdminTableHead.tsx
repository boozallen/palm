import { Flex } from '@mantine/core';

export default function UserGroupsAsAdminTableHead() {

  return (
    <thead>
      <tr>
        <th>User Group</th>
        <th>
          <Flex direction='column' align='center'>
            Members
          </Flex>
        </th>
        <th>
          {''}
        </th>
      </tr>
    </thead>
  );
}
