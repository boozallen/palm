import UserGroupGraphDatabaseRow from './UserGroupGraphDatabaseRow';

type UserGroupGraphDatabasesTableBodyProps = Readonly<{
  userGroupId: string;
  graphDatabaseEnabled: boolean;
  isAdmin: boolean;
}>;

export default function UserGroupGraphDatabasesTableBody({ 
  userGroupId, 
  graphDatabaseEnabled,
  isAdmin,
}: UserGroupGraphDatabasesTableBodyProps) {
  return (
    <tbody data-testid='user-group-graph-databases-table-body'>
      <UserGroupGraphDatabaseRow
        userGroupId={userGroupId}
        isEnabled={graphDatabaseEnabled}
        isAdmin={isAdmin}
      />
    </tbody>
  );
}
