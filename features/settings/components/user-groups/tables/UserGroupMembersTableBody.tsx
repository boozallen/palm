import UserGroupMemberRow from './UserGroupMemberRow';
import { UserGroupMembership } from '@/features/shared/types/user-group';

type UserGroupMembersTableBodyProps = Readonly<{
  userGroupMembers: UserGroupMembership[];
}>;
export default function UserGroupMembersTableBody({ userGroupMembers }: UserGroupMembersTableBodyProps) {

  return (
    <tbody data-testid='user-group-members-table-body'>
      {userGroupMembers.map((member) => (
        <UserGroupMemberRow key={member.userId} userGroupMember={member} />
      ))}
    </tbody>
  );
}
