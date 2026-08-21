import { UserGroup } from '@/features/shared/types/user-group';
import UserGroupAsAdminRow from './UserGroupAsAdminRow';

type UserGroupsAsAdminTableBodyProps = Readonly<{
  userGroups: UserGroup[];
}>;
export default function UserGroupsAsAdminTableBody({ userGroups }: UserGroupsAsAdminTableBodyProps) {

  return (
    <tbody data-testid='user-groups-as-admin-table-body'>
      {userGroups.map((userGroup) => (
        <UserGroupAsAdminRow key={userGroup.id} userGroup={userGroup} />
      ))}
    </tbody>
  );
}
