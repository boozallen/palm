import UserGroupMemberRow from './UserGroupMemberRow';
import { UserGroupMembership } from '@/features/shared/types/user-group';

type UserGroupMembersTableBodyProps = Readonly<{
  userGroupMembers: UserGroupMembership[];
  monthlyBudget: number | null | undefined;
}>;
export default function UserGroupMembersTableBody({ userGroupMembers, monthlyBudget }: UserGroupMembersTableBodyProps) {

  return (
    <tbody data-testid='user-group-members-table-body'>
      {userGroupMembers.map((member) => (
        <UserGroupMemberRow key={member.userId} userGroupMember={member} monthlyBudget={monthlyBudget} />
      ))}
    </tbody>
  );
}
