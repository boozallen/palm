import UserGroupContextStudioRow from './UserGroupContextStudioRow';

type UserGroupContextStudioTableBodyProps = Readonly<{
  userGroupId: string;
  contextStudioEnabled: boolean;
  isAdmin: boolean;
}>;

export default function UserGroupContextStudioTableBody({
  userGroupId,
  contextStudioEnabled,
  isAdmin,
}: UserGroupContextStudioTableBodyProps) {
  return (
    <tbody data-testid='user-group-context-studio-table-body'>
      <UserGroupContextStudioRow
        userGroupId={userGroupId}
        isEnabled={contextStudioEnabled}
        isAdmin={isAdmin}
      />
    </tbody>
  );
}
