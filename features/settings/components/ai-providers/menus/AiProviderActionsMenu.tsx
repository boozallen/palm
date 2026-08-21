import { ActionIcon, Menu } from '@mantine/core';
import { IconDotsVertical } from '@tabler/icons-react';

export type AiProviderActionsMenuProps = Readonly<{
  providerId: string;
  providerLabel: string;
  onEditClick: () => void;
  onDeleteClick: () => void;
  onAddModelClick: () => void;
}>

export function AiProviderActionsMenu({ providerId, providerLabel, onEditClick, onDeleteClick, onAddModelClick }: AiProviderActionsMenuProps) {
  return (
    <Menu>
      <Menu.Target>
        <ActionIcon aria-label={`Actions for ${providerLabel}`}>
          <IconDotsVertical data-testid={`${providerId}-actions-menu`} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown data-testid={`${providerId}-menu-dropdown`}>
        <Menu.Item onClick={onAddModelClick}>Add Model</Menu.Item>
        <Menu.Item onClick={onEditClick}>Edit</Menu.Item>
        <Menu.Item c='red.6' onClick={onDeleteClick}>Delete</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
