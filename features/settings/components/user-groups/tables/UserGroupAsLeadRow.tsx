import { Group, Anchor } from '@mantine/core';
import { UserGroup } from '@/features/shared/types/user-group';
import { IconUsers } from '@tabler/icons-react';

export type UserGroupAsLeadRowProps = Readonly<{
  userGroup: UserGroup;
}>;

export default function UserGroupAsLeadRow({ userGroup }: UserGroupAsLeadRowProps) {
  return (
    <tr data-testid={`${userGroup.id}-user-group-as-lead-row`}>
      <td>
        <Anchor href={`/settings/user-groups/${userGroup.id}`}>
          {userGroup.label}
        </Anchor>
      </td>

      <td>
        <Group position='center'>
          <IconUsers stroke={1.5} />
          {userGroup.memberCount.toString()}
        </Group>
      </td>
    </tr>
  );
}
