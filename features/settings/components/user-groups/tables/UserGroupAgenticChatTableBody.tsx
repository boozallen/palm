import UserGroupAgenticChatRow from './UserGroupAgenticChatRow';

type UserGroupAgenticChatTableBodyProps = Readonly<{
  userGroupId: string;
  agenticChatEnabled: boolean;
  isAdmin: boolean;
}>;

export default function UserGroupAgenticChatTableBody({
  userGroupId,
  agenticChatEnabled,
  isAdmin,
}: UserGroupAgenticChatTableBodyProps) {
  return (
    <tbody data-testid='user-group-agentic-chat-table-body'>
      <UserGroupAgenticChatRow
        userGroupId={userGroupId}
        isEnabled={agenticChatEnabled}
        isAdmin={isAdmin}
      />
    </tbody>
  );
}
