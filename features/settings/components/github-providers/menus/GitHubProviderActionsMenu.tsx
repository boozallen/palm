import { ActionIcon, Menu } from '@mantine/core';
import { IconDotsVertical } from '@tabler/icons-react';

export type GitHubProviderActionsMenuProps = Readonly<{
  onEditClick: () => void;
  onDeleteClick: () => void;
}>;

export function GitHubProviderActionsMenu({
  onEditClick,
  onDeleteClick,
}: GitHubProviderActionsMenuProps) {
  return (
    <Menu>
      <Menu.Target>
        <ActionIcon aria-label='GitHub provider actions'>
          <IconDotsVertical />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onEditClick}>Edit</Menu.Item>
        <Menu.Item c='red.6' onClick={onDeleteClick}>Delete</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
