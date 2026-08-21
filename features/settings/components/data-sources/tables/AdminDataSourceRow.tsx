import { Badge, Text, ActionIcon, Tooltip, Button, Modal, Stack, Popover, Box, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUsers, IconTrash, IconCheck, IconX, IconShieldUp, IconShieldDown, IconArrowDown, IconClock, IconCircleCheck, IconCircleX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { trpc } from '@/libs';
import useDemoteAdminDocument from '@/features/settings/api/data-sources/demote-admin-document';
import useDeleteDocument from '@/features/shared/api/document-upload/delete-document';
import AssignGroupsModal from '../modals/AssignGroupsModal';
import { AdminDocumentRow, GroupOption } from './AdminDataSourcesTable';
import { uploadStatusColorCode } from '@/features/shared/types/document';

type AdminDataSourceRowProps = {
  document: AdminDocumentRow;
  availableGroups: GroupOption[];
  currentUserId: string;
  onPromoteDocument: (documentId: string) => void;
};

export default function AdminDataSourceRow({
  document,
  availableGroups,
  currentUserId,
  onPromoteDocument,
}: Readonly<AdminDataSourceRowProps>) {
  const [assignOpened, { open: openAssign, close: closeAssign }] = useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [demoteOpened, { open: openDemote, close: closeDemote }] = useDisclosure(false);
  const [lineagePopoverOpened, { open: openLineagePopover, close: closeLineagePopover }] = useDisclosure(false);

  const utils = trpc.useUtils();
  const { mutateAsync: demoteAdminDocument, isPending: isDemoting } = useDemoteAdminDocument();
  const { mutateAsync: deleteDocument, isPending: isDeleting } = useDeleteDocument();

  const assignedGroupLabels = document.assignedGroupIds
    .map(id => availableGroups.find(g => g.id === id)?.label)
    .filter((label): label is string => label !== undefined);

  const handleDelete = async () => {
    try {
      await deleteDocument({ documentId: document.id });
      notifications.show({
        title: 'Document Deleted',
        message: `"${document.filename}" has been permanently deleted`,
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: 3000,
      });
      utils.settings.dataSources.getAdminDocuments.invalidate();
      utils.shared.getDocuments.invalidate();
      closeDelete();
    } catch (error) {
      notifications.show({
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'Failed to delete document',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
        withCloseButton: true,
      });
    }
  };

  const handleDemote = async () => {
    try {
      await demoteAdminDocument({ documentId: document.id });
      notifications.show({
        title: 'Admin Status Removed',
        message: `"${document.filename}" is no longer an admin data source`,
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: 3000,
      });
      utils.settings.dataSources.getAdminDocuments.invalidate();
      utils.shared.getDocuments.invalidate();
      closeDemote();
    } catch (error) {
      notifications.show({
        title: 'Demotion Failed',
        message: error instanceof Error ? error.message : 'Failed to remove admin status',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
        withCloseButton: true,
      });
    }
  };

  const isOwnedByUser = document.userId === currentUserId;

  const renderLineageChain = () => {
    if (!document.lineage || document.lineage.chain.length === 0) {
      return null;
    }

    // Render each node in the chain with proper indentation
    return (
      <Stack spacing={0}>
        <Text fz='xs' fw={600} c='gray.3' mb='sm'>Sharing Chain:</Text>
        {document.lineage.chain.map((node, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === document.lineage!.chain.length - 1;
          const paddingLeft = idx * 20;

          // Get group labels for this node
          const nodeGroupLabels = node.userGroupIds
            ?.map(id => availableGroups.find(g => g.id === id)?.label)
            .filter((label): label is string => label !== undefined) || [];

          return (
            <Box key={node.userId}>
              <Group spacing='xs' pl={paddingLeft} mb='xs'>
                <IconArrowDown size={14} color={isLast ? '#22b8cf' : '#868e96'} />
                <Stack spacing={4}>
                  <Text
                    fz='sm'
                    fw={isLast ? 600 : 400}
                    c={isLast ? 'cyan' : 'gray.4'}
                  >
                    {node.userName}
                    {isFirst && ' (Original)'}
                    {isLast && ' (Current)'}
                  </Text>
                  {node.userEmail && (
                    <Text fz='xs' c='dimmed'>{node.userEmail}</Text>
                  )}
                  {nodeGroupLabels.length > 0 && (
                    <Group spacing={4}>
                      {nodeGroupLabels.map(label => (
                        <Badge key={label} variant='outline' color='gray' size='xs'>
                          {label}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Stack>
              </Group>
            </Box>
          );
        })}
      </Stack>
    );
  };

  const renderLineage = () => {
    if (!document.lineage) {
      return <Text fz='sm' c='dimmed' data-testid='lineage-loading'>Loading...</Text>;
    }

    if (document.lineage.depth === 0) {
      return (
        <Badge variant='filled' color='blue' data-testid='lineage-original'>
          Original
        </Badge>
      );
    }

    const generationText = document.lineage.depth === 1 ? '2nd gen' : document.lineage.depth === 2 ? '3rd gen' : `${document.lineage.depth + 1}th gen`;

    return (
      <Popover
        width={300}
        position='bottom'
        withArrow
        shadow='md'
        opened={lineagePopoverOpened}
        onClose={closeLineagePopover}
      >
        <Popover.Target>
          <Badge
            variant='outline'
            color='cyan'
            style={{ cursor: 'pointer' }}
            onMouseEnter={openLineagePopover}
            onMouseLeave={closeLineagePopover}
            data-testid={`lineage-generation-${document.lineage.depth}`}
          >
            {generationText}
          </Badge>
        </Popover.Target>
        <Popover.Dropdown
          onMouseEnter={openLineagePopover}
          onMouseLeave={closeLineagePopover}
          sx={{ pointerEvents: 'all' }}
          data-testid='lineage-popover'
        >
          {renderLineageChain()}
        </Popover.Dropdown>
      </Popover>
    );
  };

  const renderShareStatus = () => {
    if (!document.shareStatusCounts) {
      return null;
    }

    const { pending, accepted, rejected } = document.shareStatusCounts;
    const hasShares = pending > 0 || accepted > 0 || rejected > 0;

    if (!hasShares) {
      return null;
    }

    return (
      <Group spacing='sm' data-testid='share-status-group'>
        {pending > 0 && (
          <Tooltip label={`${pending} pending ${pending === 1 ? 'share' : 'shares'}`} withinPortal>
            <Group spacing={4} style={{ cursor: 'default' }} data-testid='share-status-pending'>
              <IconClock size={16} color='#fab005' />
              <Text fz='xs' c='yellow.4'>{pending}</Text>
            </Group>
          </Tooltip>
        )}
        {accepted > 0 && (
          <Tooltip label={`${accepted} accepted ${accepted === 1 ? 'share' : 'shares'}`} withinPortal>
            <Group spacing={4} style={{ cursor: 'default' }} data-testid='share-status-accepted'>
              <IconCircleCheck size={16} color='#12b886' />
              <Text fz='xs' c='teal.4'>{accepted}</Text>
            </Group>
          </Tooltip>
        )}
        {rejected > 0 && (
          <Tooltip label={`${rejected} rejected ${rejected === 1 ? 'share' : 'shares'}`} withinPortal>
            <Group spacing={4} style={{ cursor: 'default' }} data-testid='share-status-rejected'>
              <IconCircleX size={16} color='#fa5252' />
              <Text fz='xs' c='red.4'>{rejected}</Text>
            </Group>
          </Tooltip>
        )}
      </Group>
    );
  };

  const renderUploadStatus = () => {
    const color = uploadStatusColorCode[document.uploadStatus];

    return (
      <Badge variant='filled' color={color} data-testid={`upload-status-${document.uploadStatus.toLowerCase()}`}>
        {document.uploadStatus}
      </Badge>
    );
  };

  const renderGraphStatus = () => {
    if (!document.graphJobInfo) {
      return <Text fz='sm' c='dimmed'>Ungraphed</Text>;
    }

    const { status, progress, errorMessage, completedAt } = document.graphJobInfo;

    const statusConfig = {
      Pending: { color: 'yellow', label: 'Pending' },
      Building: { color: 'orange', label: 'Building' },
      Resolving: { color: 'violet', label: 'Resolving' },
      Completed: { color: 'teal', label: 'Completed' },
      Failed: { color: 'red', label: 'Failed' },
    };

    const config = statusConfig[status];

    const tooltipContent = (
      <Stack spacing={4}>
        <Text fz='xs'>
          <Text component='span' fw={600}>Status:</Text> {config.label}
        </Text>
        {progress && (
          <>
            {progress.currentStep && (
              <Text fz='xs'>
                <Text component='span' fw={600}>Step:</Text> {progress.currentStep}
              </Text>
            )}
            {progress.processedChunks !== undefined && progress.totalChunks !== undefined && (
              <Text fz='xs'>
                <Text component='span' fw={600}>Progress:</Text> {progress.processedChunks}/{progress.totalChunks} chunks
              </Text>
            )}
          </>
        )}
        {completedAt && (
          <Text fz='xs'>
            <Text component='span' fw={600}>Completed:</Text> {new Date(completedAt).toLocaleString('en-US', {
              month: 'numeric',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              hour12: true,
            })}
          </Text>
        )}
        {errorMessage && (
          <Text fz='xs' c='red'>
            <Text component='span' fw={600}>Error:</Text> {errorMessage}
          </Text>
        )}
      </Stack>
    );

    return (
      <Tooltip label={tooltipContent} multiline width={220} withinPortal>
        <Badge variant='filled' color={config.color}>
          {config.label}
        </Badge>
      </Tooltip>
    );
  };

  return (
    <>
      <AssignGroupsModal
        documentId={document.id}
        currentGroupIds={document.assignedGroupIds}
        modalOpen={assignOpened}
        closeModalHandler={closeAssign}
        availableGroups={availableGroups}
      />
      <Modal
        opened={demoteOpened}
        onClose={closeDemote}
        withCloseButton={false}
        title='Remove Group Resource Status'
        data-testid='demote-admin-document-modal'
        centered
      >
        <Text color='gray.7' fz='sm' mb='md'>
          Are you sure you want to remove group resource status from this document? It will remain in the library but user group access will be revoked.
        </Text>
        <Group spacing='lg' grow>
          <Button variant='outline' onClick={closeDemote}>Cancel</Button>
          <Button onClick={handleDemote} loading={isDemoting} disabled={isDemoting}>
            {isDemoting ? 'Removing' : 'Remove Group Resource Status'}
          </Button>
        </Group>
      </Modal>
      <Modal
        opened={deleteOpened}
        onClose={closeDelete}
        withCloseButton={false}
        title='Delete Document'
        data-testid='delete-document-modal'
        centered
      >
        <Text color='gray.7' fz='sm' mb='md'>
          Are you sure you want to permanently delete this document? This action cannot be undone.
        </Text>
        <Group spacing='lg' grow>
          <Button variant='outline' onClick={closeDelete}>Cancel</Button>
          <Button onClick={handleDelete} loading={isDeleting} disabled={isDeleting}>
            {isDeleting ? 'Deleting' : 'Delete'}
          </Button>
        </Group>
      </Modal>

      <tr data-testid={`admin-document-row-${document.id}`}>
        <td data-testid='document-filename'>
          <Tooltip label={document.filename} withinPortal>
            <Text
              fw={500}
              fz='sm'
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '300px',
              }}
            >
              {document.filename}
            </Text>
          </Tooltip>
        </td>
        <td data-testid='document-owner'>
          <Text fz='sm'>{document.userName}</Text>
        </td>
        <td data-testid='document-admin-groups'>
          {assignedGroupLabels.length > 0 ? (
            <Group spacing='xs'>
              {assignedGroupLabels.slice(0, 2).map(label => (
                <Badge key={label} variant='outline' color='gray' data-testid={`admin-group-badge-${label}`}>
                  {label}
                </Badge>
              ))}
              {assignedGroupLabels.length > 2 && (
                <Tooltip
                  label={assignedGroupLabels.slice(2).join(', ')}
                  withinPortal
                  multiline
                  width={220}
                >
                  <Badge variant='outline' color='gray' style={{ cursor: 'default' }} data-testid='admin-group-more-badge'>
                    +{assignedGroupLabels.length - 2} more
                  </Badge>
                </Tooltip>
              )}
            </Group>
          ) : (
            <Text fz='sm' c='dimmed' data-testid='document-unshared'>Unshared</Text>
          )}
        </td>
        <td data-testid='document-sharing'>
          <Group spacing='md' align='center'>
            {renderLineage()}
            {renderShareStatus()}
          </Group>
        </td>
        <td data-testid='document-upload-status'>
          {renderUploadStatus()}
        </td>
        <td data-testid='document-graph-status'>
          {renderGraphStatus()}
        </td>
        <td>
          {new Date(document.createdAt).toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
          })}
        </td>
        <td>
          <Group spacing='xs'>
            {document.adminCreated ? (
              <>
                <Tooltip label='Assign groups' withArrow>
                  <ActionIcon
                    onClick={openAssign}
                    aria-label={`Assign groups for ${document.filename}`}
                  >
                    <IconUsers />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label='Remove admin status' withArrow>
                  <ActionIcon
                    onClick={openDemote}
                    aria-label={`Remove admin status from ${document.filename}`}
                  >
                    <IconShieldDown />
                  </ActionIcon>
                </Tooltip>
              </>
            ) : isOwnedByUser ? (
              <Tooltip label='Promote to admin data source' withArrow>
                <ActionIcon
                  onClick={() => onPromoteDocument(document.id)}
                  aria-label={`Promote ${document.filename} to admin data source`}
                >
                  <IconShieldUp />
                </ActionIcon>
              </Tooltip>
            ) : null}
            <Tooltip label='Delete document' withArrow>
              <ActionIcon
                onClick={openDelete}
                aria-label={`Delete ${document.filename}`}
              >
                <IconTrash />
              </ActionIcon>
            </Tooltip>
          </Group>
        </td>
      </tr>
    </>
  );
}
