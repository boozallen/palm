import { Group } from '@mantine/core';

import { DeleteUserEntry } from './action-item/DeleteUserEntry';
import { EditUserEntry } from './action-item/EditUserEntry';

type UserEntryActionsProps = Readonly<{
  entryId: string;
}>

export function UserEntryActions({
  entryId,
}: UserEntryActionsProps) {

  return (
    <Group spacing='xs'>
      <EditUserEntry entryId={entryId} />
      <DeleteUserEntry entryId={entryId} />
    </Group>
  );
}
