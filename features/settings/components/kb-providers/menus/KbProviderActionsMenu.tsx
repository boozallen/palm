import { ActionIcon, Menu } from '@mantine/core';
import { IconDotsVertical } from '@tabler/icons-react';

export type KbProviderActionsMenuProps = Readonly<{
  kbProviderId: string;
  kbProviderLabel: string;
  onEditClick: () => void;
  onDeleteClick: () => void;
  onAddKnowledgeBaseClick: () => void;
}>;

export function KbProviderActionsMenu({
  kbProviderId,
  kbProviderLabel,
  onEditClick,
  onDeleteClick,
  onAddKnowledgeBaseClick,
}: KbProviderActionsMenuProps) {

  return (
    <Menu>
      <Menu.Target>
        <ActionIcon aria-label={`Actions for ${kbProviderLabel}`}>
          <IconDotsVertical data-testid={`${kbProviderId}-actions-menu`} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown data-testid={`${kbProviderId}-menu-dropdown`}>
        <Menu.Item onClick={onAddKnowledgeBaseClick}>Add Knowledge Base</Menu.Item>
        <Menu.Item onClick={onEditClick}>Edit</Menu.Item>
        <Menu.Item c='red.6' onClick={onDeleteClick}>Delete</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
