import { Group, Anchor } from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import Link from 'next/link';

import { UserGroup } from '@/features/shared/types/user-group';

export type UserGroupAsLeadRowProps = Readonly<{
  userGroup: UserGroup;
}>;

export default function UserGroupAsLeadRow({ userGroup }: UserGroupAsLeadRowProps) {
  return (
    <tr data-testid={`${userGroup.id}-user-group-as-lead-row`}>
      <td>
        <Anchor
          href={`/settings/user-groups/${userGroup.id}`}
          component={Link}
        >
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
