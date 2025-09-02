import { UserGroup } from '@/features/shared/types/user-group';
import UserGroupAsLeadRow from './UserGroupAsLeadRow';

type UserGroupsAsLeadTableBodyProps = Readonly<{
  userGroups: UserGroup[];
}>;

export default function UserGroupsAsLeadTableBody({ userGroups }: UserGroupsAsLeadTableBodyProps) {
  return (
    <tbody data-testid='user-groups-as-lead-table-body'>
      {userGroups.map((userGroup) => (
        <UserGroupAsLeadRow key={userGroup.id} userGroup={userGroup} />
      ))}
    </tbody>
  );
}
