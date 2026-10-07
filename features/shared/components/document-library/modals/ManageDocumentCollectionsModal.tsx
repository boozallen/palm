import { useState } from 'react';
import { Modal, Stack, Checkbox, Button, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';
import useAddDocumentToCollection from '@/features/shared/api/document-collections/use-add-document-to-collection';
import useRemoveDocumentFromCollection from '@/features/shared/api/document-collections/use-remove-document-from-collection';

type ManageDocumentCollectionsModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  documentId: string;
  documentFilename: string;
  currentCollectionIds: string[];
}>;

export default function ManageDocumentCollectionsModal({
  modalOpened,
  closeModalHandler,
  documentId,
  documentFilename,
  currentCollectionIds,
}: ManageDocumentCollectionsModalProps) {
  const { data: collectionsData } = useGetCollections();
  const { mutateAsync: addToCollection, isPending: isAdding } = useAddDocumentToCollection();
  const { mutateAsync: removeFromCollection, isPending: isRemoving } = useRemoveDocumentFromCollection();

  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(
    new Set(currentCollectionIds)
  );

  const collections = collectionsData?.collections || [];
  const isLoading = isAdding || isRemoving;

  const handleToggle = (collectionId: string) => {
    const newSet = new Set(selectedCollectionIds);
    if (newSet.has(collectionId)) {
      newSet.delete(collectionId);
    } else {
      newSet.add(collectionId);
    }
    setSelectedCollectionIds(newSet);
  };

  const handleSave = async () => {
    try {
      const currentSet = new Set(currentCollectionIds);
      const toAdd = Array.from(selectedCollectionIds).filter((id) => !currentSet.has(id));
      const toRemove = Array.from(currentSet).filter((id) => !selectedCollectionIds.has(id));

      for (const collectionId of toAdd) {
        await addToCollection({ documentId, collectionId });
      }

      for (const collectionId of toRemove) {
        await removeFromCollection({ documentId, collectionId });
      }

      notifications.show({
        title: 'Success',
        message: 'Document collections updated',
        color: 'green',
      });

      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update document collections',
        color: 'red',
      });
    }
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      title='Manage Document Collections'
      size='md'
      withCloseButton={false}
      centered
      data-testid='manage-document-collections-modal'
    >
      <Stack spacing='md'>
        <Text size='sm' color='dimmed'>
          Select collections for <strong>{documentFilename}</strong>
        </Text>

        {collections.length === 0 ? (
          <Text size='sm' color='dimmed'>
            No collections yet. Create a collection first to organize your documents.
          </Text>
        ) : (
          <Stack spacing='xs'>
            {collections.map((collection) => (
              <Checkbox
                key={collection.id}
                label={collection.name}
                checked={selectedCollectionIds.has(collection.id)}
                onChange={() => handleToggle(collection.id)}
                styles={{
                  label: {
                    cursor: 'pointer',
                  },
                }}
              />
            ))}
          </Stack>
        )}

        <Group spacing='lg' grow mt='md'>
          <Button variant='outline' onClick={closeModalHandler} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isLoading} disabled={collections.length === 0}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
