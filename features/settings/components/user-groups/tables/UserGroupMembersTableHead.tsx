export default function UserGroupMembershipTableHead() {

  return (
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Last Login</th>
        <th colSpan={2}>Role</th>
      </tr>
    </thead>
  );
}
