import { ActionIcon, Menu } from '@mantine/core';
import { IconDotsVertical } from '@tabler/icons-react';

export type AgentProviderActionsMenuProps = Readonly<{
  agentProviderId: string;
  agentProviderName: string;
  onEditClick: () => void;
  onDeleteClick: () => void;
}>;

export function AgentProviderActionsMenu({
  agentProviderId,
  agentProviderName,
  onEditClick,
  onDeleteClick,
}: AgentProviderActionsMenuProps) {
  return (
    <Menu>
      <Menu.Target>
        <ActionIcon aria-label={`Actions for ${agentProviderName}`}>
          <IconDotsVertical data-testid={`${agentProviderId}-actions-menu`} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown data-testid={`${agentProviderId}-menu-dropdown`}>
        <Menu.Item onClick={onEditClick}>Edit</Menu.Item>
        <Menu.Item c='red.6' onClick={onDeleteClick}>Delete</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
