import type { UserGroupRole } from '@/features/shared/types/user-group';

interface UserGroupRowProps {
  group: { id: string, label: string, role: UserGroupRole };
}
export default function UserGroupRow({ group }: Readonly<UserGroupRowProps>) {
  return (
    <tr>
      <td>{group.label}</td>
      <td>{group.role}</td>
    </tr>
  );
}
