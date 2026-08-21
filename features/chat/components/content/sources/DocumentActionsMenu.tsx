import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import { IconDotsVertical } from '@tabler/icons-react';

export type DocumentActionsMenuProps = Readonly<{
  sourceId: string;
  sourceLabel: string;
  onShareClick: (event: React.MouseEvent) => void;
  onDeleteClick?: (event?: React.MouseEvent) => void;
  onReshareClick?: (event: React.MouseEvent) => void;
  onManageCollectionsClick?: (event: React.MouseEvent) => void;
  isShared?: boolean;
  isGraphing?: boolean;
  documentSharingEnabled?: boolean;
  isAdminDocument?: boolean;
}>

export function DocumentActionsMenu({ sourceId, sourceLabel, onShareClick, onDeleteClick, onReshareClick, onManageCollectionsClick, isShared = false, isGraphing = false, documentSharingEnabled, isAdminDocument = false }: DocumentActionsMenuProps) {
  const adminTooltipText = 'Admin/lead source files may not be deleted or shared';

  const isShareDisabled = isGraphing || isAdminDocument;
  const shareTooltipText = isAdminDocument
    ? adminTooltipText
    : isGraphing
      ? 'Cannot share while document is being graphed'
      : undefined;

  const isDeleteDisabled = isGraphing || isAdminDocument;
  const deleteTooltipText = isAdminDocument
    ? adminTooltipText
    : isGraphing
      ? 'Unable to delete a document while it is being graphed'
      : undefined;

  return (
    <Menu withinPortal position='bottom'>
      <Menu.Target>
        <ActionIcon
          aria-label={`Actions for ${sourceLabel}`}
          variant='subtle'
          size='sm'
          color='gray.5'
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          data-testid={`${sourceId}-actions-menu`}
        >
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown data-testid={`${sourceId}-menu-dropdown`}>
        {onManageCollectionsClick && (
          <Menu.Item
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              onManageCollectionsClick(e);
            }}
            data-testid={`${sourceId}-collections-menu-item`}
          >
            Manage collections
          </Menu.Item>
        )}
        {documentSharingEnabled && (
          <Tooltip label={shareTooltipText} disabled={!isShareDisabled} position='right' withinPortal>
            <div
              onClick={isShareDisabled ? (e: React.MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
              } : undefined}
            >
              <Menu.Item
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!isShareDisabled) {
                    if (isShared && onReshareClick) {
                      onReshareClick(e);
                    } else {
                      onShareClick(e);
                    }
                  }
                }}
                disabled={isShareDisabled}
                style={isShareDisabled ? { pointerEvents: 'none' } : undefined}
                data-testid={`${sourceId}-share-menu-item`}
              >
                Manage share settings
              </Menu.Item>
            </div>
          </Tooltip>
        )}
        <Tooltip label={deleteTooltipText} disabled={!isDeleteDisabled} position='right' withinPortal>
          <div 
            onClick={isDeleteDisabled ? (e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
            } : undefined}
          >
            <Menu.Item 
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();
                if (!isDeleteDisabled) {
                  onDeleteClick?.(event);
                }
              }}
              disabled={isDeleteDisabled}
              style={isDeleteDisabled ? { pointerEvents: 'none' } : undefined}
              color='red'
              data-testid={`${sourceId}-delete-menu-item`}
            >
              Delete
            </Menu.Item>
          </div>
        </Tooltip>
      </Menu.Dropdown>
    </Menu>
  );
}
