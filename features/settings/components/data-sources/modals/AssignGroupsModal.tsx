import { useState } from 'react';
import { Modal, Stack, MultiSelect, Group, Button } from '@mantine/core';
import { IconX, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { trpc } from '@/libs';
import useAssignAdminDocumentGroups from '@/features/settings/api/data-sources/assign-groups';
import { GroupOption } from '@/features/settings/components/data-sources/tables/AdminDataSourcesTable';

type AssignGroupsModalProps = {
  documentId: string;
  currentGroupIds: string[];
  modalOpen: boolean;
  closeModalHandler: () => void;
  availableGroups: GroupOption[];
};

export default function AssignGroupsModal({
  documentId,
  currentGroupIds,
  modalOpen,
  closeModalHandler,
  availableGroups,
}: Readonly<AssignGroupsModalProps>) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(currentGroupIds);

  const utils = trpc.useUtils();
  const { mutateAsync: assignGroups, isPending } = useAssignAdminDocumentGroups();

  const groupOptions = availableGroups.map(g => ({ value: g.id, label: g.label }));

  const handleSubmit = async () => {
    try {
      await assignGroups({ documentId, userGroupIds: selectedGroupIds });

      notifications.show({
        title: 'Groups Updated',
        message: 'Group assignments have been saved',
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: 3000,
      });

      utils.settings.dataSources.getAdminDocuments.invalidate();
      closeModalHandler();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update groups';
      notifications.show({
        title: 'Update Failed',
        message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
        withCloseButton: true,
      });
    }
  };

  const handleOpen = () => {
    setSelectedGroupIds(currentGroupIds);
  };

  return (
    <Modal
      title='Assign Groups'
      opened={modalOpen}
      onClose={closeModalHandler}
      onTransitionEnd={modalOpen ? handleOpen : undefined}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <Stack spacing='sm'>
        <MultiSelect
          label='User Groups'
          placeholder='Select groups'
          data={groupOptions}
          value={selectedGroupIds}
          onChange={setSelectedGroupIds}
          searchable
          withinPortal
          dropdownPosition='bottom'
        />

        <Group spacing='lg' grow mt='sm'>
          <Button variant='outline' onClick={closeModalHandler} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isPending}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
