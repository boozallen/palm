import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, MultiSelect, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { trpc } from '@/libs';
import usePromoteFromLibrary from '@/features/settings/api/data-sources/promote-admin-document';
import { GroupOption } from '../tables/AdminDataSourcesTable';

type ShareFolderModalProps = {
  opened: boolean;
  onClose: () => void;
  collectionId: string | null;
  collectionName: string;
  initialGroupIds?: string[];
  mixedWarning?: boolean;
  availableGroups: GroupOption[];
};

export default function ShareFolderModal({
  opened,
  onClose,
  collectionId,
  collectionName,
  initialGroupIds = [],
  mixedWarning = false,
  availableGroups,
}: Readonly<ShareFolderModalProps>) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(initialGroupIds);
  const utils = trpc.useUtils();
  const { mutateAsync: promoteFromLibrary, isPending } = usePromoteFromLibrary();

  // Editing an already-shared folder pre-fills its current groups; designating
  // an unshared folder starts empty.
  const isEditing = initialGroupIds.length > 0;

  useEffect(() => {
    if (opened) {
      setSelectedGroupIds(initialGroupIds);
    }
    // initialGroupIds is read only on the open edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const handleShare = async () => {
    if (!collectionId || selectedGroupIds.length === 0) {
      return;
    }
    try {
      await promoteFromLibrary({ collectionId, userGroupIds: selectedGroupIds });
      await utils.settings.dataSources.getAdminDocuments.invalidate();
      await utils.shared.getDocuments.invalidate();
      notifications.show({
        title: isEditing ? 'Groups Updated' : 'Folder Shared',
        message: isEditing
          ? `Group access for "${collectionName}" has been updated`
          : `"${collectionName}" has been shared as an admin data source`,
        variant: 'successful_operation',
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share folder';
      notifications.show({
        title: isEditing ? 'Update Failed' : 'Share Failed',
        message,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? `Edit groups: ${collectionName}` : `Share folder: ${collectionName}`}
      centered
      withCloseButton={false}
      closeOnClickOutside={false}
      data-testid='share-folder-modal'
    >
      <Stack spacing='md'>
        <Text fz='sm' c='dimmed'>
          Every document in this folder is promoted to an admin data source for the selected
          groups, and the folder itself is surfaced read-only to those group members.
        </Text>
        {mixedWarning && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color='yellow'
            data-testid='share-folder-mixed-warning'
          >
            Documents in this folder are currently shared to different groups. Saving will apply
            the selected groups to <strong>every</strong> document, replacing their individual
            assignments.
          </Alert>
        )}
        <MultiSelect
          label='User groups'
          placeholder={availableGroups.length === 0 ? 'No user groups available' : 'Select user groups'}
          data={availableGroups.map((g) => ({ value: g.id, label: g.label }))}
          value={selectedGroupIds}
          onChange={setSelectedGroupIds}
          searchable
          withinPortal
          dropdownPosition='bottom'
          data-testid='share-folder-groups'
        />
        <Group spacing='lg' grow mt='sm'>
          <Button variant='outline' onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            loading={isPending}
            disabled={selectedGroupIds.length === 0}
            data-testid='share-folder-confirm'
          >
            {isEditing ? 'Save' : 'Share'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
