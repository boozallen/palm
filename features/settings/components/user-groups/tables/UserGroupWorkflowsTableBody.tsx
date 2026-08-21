import UserGroupWorkflowsRow from './UserGroupWorkflowsRow';

type UserGroupWorkflowsTableBodyProps = Readonly<{
  userGroupId: string;
  workflowsEnabled: boolean;
  isAdmin: boolean;
}>;

export default function UserGroupWorkflowsTableBody({ 
  userGroupId, 
  workflowsEnabled,
  isAdmin,
}: UserGroupWorkflowsTableBodyProps) {
  return (
    <tbody data-testid='user-group-workflows-table-body'>
      <UserGroupWorkflowsRow
        userGroupId={userGroupId}
        isEnabled={workflowsEnabled}
        isAdmin={isAdmin}
      />
    </tbody>
  );
}