import { Flex } from '@mantine/core';

export default function UserGroupsAsLeadTableHead() {
  return (
    <thead data-testid='user-groups-as-lead-table-head'>
      <tr>
        <th>User Group</th>
        <th>
          <Flex direction='column' align='center'>
            Members
          </Flex>
        </th>
      </tr>
    </thead>
  );
}
