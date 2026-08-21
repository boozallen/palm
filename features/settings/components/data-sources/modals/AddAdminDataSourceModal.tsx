import { useState, useEffect } from 'react';
import {
  Modal,
  Text,
  Group,
  Stack,
  Button,
  MultiSelect,
  Select,
  TextInput,
} from '@mantine/core';
import { IconX, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';

import { DocumentUploadStatus } from '@/features/shared/types/document';
import { trpc } from '@/libs';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/settings/api/data-sources/get-documents';
import usePromoteFromLibrary from '@/features/settings/api/data-sources/promote-admin-document';
import { GroupOption } from '@/features/settings/components/data-sources/tables/AdminDataSourcesTable';

type AddAdminDataSourceModalProps = {
  modalOpen: boolean;
  closeModalHandler: () => void;
  availableGroups: GroupOption[];
  preselectedDocumentId?: string;
};

export default function AddAdminDataSourceModal({
  modalOpen,
  closeModalHandler,
  availableGroups,
  preselectedDocumentId,
}: Readonly<AddAdminDataSourceModalProps>) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(preselectedDocumentId ?? null);

  const { data: sessionData } = useSession();
  const currentUserId = sessionData?.user?.id ?? '';

  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId ?? '';

  const { data: allDocuments } = useGetDocuments({
    documentUploadProviderId,
    enabled: !!documentUploadProviderId && modalOpen,
  });

  // Admins can only promote their own documents for now
  const libraryOptions = (allDocuments?.documents ?? [])
    .filter(doc => doc.userId === currentUserId && !doc.adminCreated && doc.uploadStatus === DocumentUploadStatus.Completed)
    .map(doc => ({ value: doc.id, label: doc.filename }));

  // When launched from a specific document row, the document is fixed — show it
  // read-only rather than offering a picker of the whole library.
  const preselectedDocName =
    (allDocuments?.documents ?? []).find(doc => doc.id === preselectedDocumentId)?.filename ?? '';

  const utils = trpc.useUtils();
  const { mutateAsync: promoteFromLibrary, isPending: isPromoting } = usePromoteFromLibrary();

  const groupOptions = availableGroups.map(g => ({ value: g.id, label: g.label }));

  useEffect(() => {
    if (modalOpen) {
      setSelectedDocumentId(preselectedDocumentId ?? null);
      setSelectedGroupIds([]);
    }
  }, [modalOpen, preselectedDocumentId]);

  const handleSubmit = async () => {
    if (selectedGroupIds.length === 0 || !selectedDocumentId) { return; }

    try {
      await promoteFromLibrary({
        documentId: selectedDocumentId,
        userGroupIds: selectedGroupIds,
      });

      const docName = libraryOptions.find(o => o.value === selectedDocumentId)?.label ?? 'Document';
      notifications.show({
        title: 'Data Source Added',
        message: `"${docName}" has been shared as an admin data source`,
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: 3000,
      });

      utils.settings.dataSources.getAdminDocuments.invalidate();
      utils.shared.getDocuments.invalidate();
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add data source';
      notifications.show({
        title: 'Failed',
        message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
        withCloseButton: true,
      });
    }
  };

  const handleClose = () => {
    setSelectedGroupIds([]);
    setSelectedDocumentId(null);
    closeModalHandler();
  };

  const handleOpen = () => {
    setSelectedDocumentId(preselectedDocumentId ?? null);
    setSelectedGroupIds([]);
  };

  return (
    <Modal
      opened={modalOpen}
      onClose={handleClose}
      onTransitionEnd={modalOpen ? handleOpen : undefined}
      withCloseButton={false}
      title='Add Data Source'
      data-testid='add-admin-data-source-modal'
      centered
      trapFocus={false}
    >
      <Stack spacing='xs'>
        <Text color='gray.7' fz='sm' data-testid='body-text'>
          Designate a document as an admin data source to give user group members automatic access.
        </Text>

        {preselectedDocumentId ? (
          <TextInput
            label='Document'
            value={preselectedDocName}
            readOnly
            w='100%'
            data-testid='preselected-document'
          />
        ) : (
          <Select
            label='Select from Document Library'
            placeholder={libraryOptions.length === 0 ? 'No documents in your library' : 'Select a document'}
            data={libraryOptions}
            value={selectedDocumentId || null}
            onChange={setSelectedDocumentId}
            searchable
            nothingFound='No documents found'
            disabled={libraryOptions.length === 0}
            withinPortal
            w='100%'
            dropdownPosition='bottom'
          />
        )}

        <MultiSelect
          label='User Groups'
          placeholder='Select user groups to share with'
          data={groupOptions}
          value={selectedGroupIds}
          onChange={setSelectedGroupIds}
          clearable
          searchable
          description='Select which user groups should receive this data source'
          w='100%'
          dropdownPosition='bottom'
          withinPortal
        />

        <Group spacing='lg' grow mt='md'>
          <Button variant='outline' onClick={handleClose} disabled={isPromoting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isPromoting}
            disabled={selectedGroupIds.length === 0 || !selectedDocumentId}
          >
            Add Data Source
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
