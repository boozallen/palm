import { Flex } from '@mantine/core';

export type UserGroupsAsAdminTableHeadProps = Readonly<{
  showSelectedUserRole?: boolean;
}>;

export default function UserGroupsAsAdminTableHead({ showSelectedUserRole }: UserGroupsAsAdminTableHeadProps) {

  return (
    <thead>
      <tr>
        <th>User Group</th>
        <th>
          <Flex direction='column' align='center'>
            Members
          </Flex>
        </th>
        {showSelectedUserRole && (
          <th data-testid='selected-user-role-header'>Role in Group</th>
        )}
        <th>
          {''}
        </th>
      </tr>
    </thead>
  );
}
