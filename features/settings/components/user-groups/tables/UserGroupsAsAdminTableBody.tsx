import { UserGroup, UserGroupRole } from '@/features/shared/types/user-group';
import UserGroupAsAdminRow from './UserGroupAsAdminRow';

type UserGroupsAsAdminTableBodyProps = Readonly<{
  userGroups: UserGroup[];
  rolesByUserGroupId?: Record<string, UserGroupRole>;
}>;
export default function UserGroupsAsAdminTableBody({ userGroups, rolesByUserGroupId }: UserGroupsAsAdminTableBodyProps) {

  return (
    <tbody data-testid='user-groups-as-admin-table-body'>
      {userGroups.map((userGroup) => (
        <UserGroupAsAdminRow
          key={userGroup.id}
          userGroup={userGroup}
          selectedUserRole={rolesByUserGroupId?.[userGroup.id]}
        />
      ))}
    </tbody>
  );
}
