export default function UserGroupMembershipTableHead() {

  return (
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Last Login</th>
        <th data-testid='user-group-members-total-spend-header'>Total spend</th>
        <th data-testid='user-group-members-monthly-spend-header'>This month</th>
        <th colSpan={2}>Role</th>
      </tr>
    </thead>
  );
}
