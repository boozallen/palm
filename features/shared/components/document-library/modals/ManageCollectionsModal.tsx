import { useState } from 'react';
import {
  Modal,
  Stack,
  Button,
  Group,
  TextInput,
  ActionIcon,
  Text,
  ColorInput,
  Box,
} from '@mantine/core';
import { IconTrash, IconEdit, IconCheck, IconX, IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';
import useCreateCollection from '@/features/shared/api/document-collections/use-create-collection';
import useUpdateCollection from '@/features/shared/api/document-collections/use-update-collection';
import DeleteCollectionModal from '@/features/shared/components/document-library/modals/DeleteCollectionModal';

type ManageCollectionsModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
}>;

type EditingCollection = {
  id: string;
  name: string;
  color: string;
};

type DeletingCollection = {
  id: string;
  name: string;
};

const DEFAULT_COLORS = ['#228BE6', '#40C057', '#FD7E14', '#E64980', '#BE4BDB', '#15AABF'];

export default function ManageCollectionsModal({ modalOpened, closeModalHandler }: ManageCollectionsModalProps) {
  const { data: collectionsData } = useGetCollections();
  const { mutateAsync: createCollection, isPending: isCreating } = useCreateCollection();
  const { mutateAsync: updateCollection, isPending: isUpdating } = useUpdateCollection();

  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState(DEFAULT_COLORS[0]);
  const [editingCollection, setEditingCollection] = useState<EditingCollection | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<DeletingCollection | null>(null);

  const collections = collectionsData?.collections || [];
  const isLoading = isCreating || isUpdating;

  const handleCreate = async () => {
    if (!newCollectionName.trim()) {
      return;
    }

    try {
      await createCollection({
        name: newCollectionName.trim(),
        color: newCollectionColor,
      });

      notifications.show({
        title: 'Success',
        message: 'Collection created',
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });

      setNewCollectionName('');
      setNewCollectionColor(DEFAULT_COLORS[0]);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create collection',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleStartEdit = (collection: { id: string; name: string; color: string | null }) => {
    setEditingCollection({
      id: collection.id,
      name: collection.name,
      color: collection.color || '#228BE6',
    });
  };

  const handleCancelEdit = () => {
    setEditingCollection(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCollection || !editingCollection.name.trim()) {
      return;
    }

    try {
      await updateCollection({
        collectionId: editingCollection.id,
        name: editingCollection.name.trim(),
        color: editingCollection.color,
      });

      notifications.show({
        title: 'Success',
        message: 'Collection updated',
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });

      setEditingCollection(null);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update collection',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleOpenDeleteModal = (collection: { id: string; name: string }) => {
    setDeletingCollection({
      id: collection.id,
      name: collection.name,
    });
  };

  const handleCloseDeleteModal = () => {
    setDeletingCollection(null);
  };

  return (
    <>
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      title='Manage Collections'
      size='lg'
      withCloseButton={false}
      centered
      data-testid='manage-collections-modal'
    >
      <Stack spacing='md'>
        {/* Create new collection */}
        <Box>
          <Text size='sm' weight={500} mb='xs'>
            Create New Collection
          </Text>
          <Group spacing='xs' align='right-end'>
            <TextInput
              placeholder='Collection name'
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                }
              }}
            />
            <ColorInput
              value={newCollectionColor}
              onChange={setNewCollectionColor}
              swatches={DEFAULT_COLORS}
              style={{ width: 100 }}
            />
            <Button
              leftIcon={<IconPlus size={16} />}
              onClick={handleCreate}
              loading={isCreating}
              disabled={!newCollectionName.trim() || isLoading}
            >
              Add
            </Button>
          </Group>
        </Box>

        {/* Existing collections */}
        <Box>
          <Text size='sm' weight={500} mb='xs'>
            Your Collections ({collections.length})
          </Text>
          {collections.length === 0 ? (
            <Text size='sm' color='dimmed'>
              No collections yet
            </Text>
          ) : (
            <Stack spacing='xs'>
              {collections.map((collection) => (
                <Group key={collection.id} spacing='xs' position='apart'>
                  {editingCollection?.id === collection.id ? (
                    <>
                      <TextInput
                        value={editingCollection.name}
                        onChange={(e) =>
                          setEditingCollection({ ...editingCollection, name: e.target.value })
                        }
                        style={{ flex: 1 }}
                      />
                      <ColorInput
                        value={editingCollection.color}
                        onChange={(color) =>
                          setEditingCollection({ ...editingCollection, color })
                        }
                        swatches={DEFAULT_COLORS}
                        style={{ width: 100 }}
                      />
                      <Group>
                        <ActionIcon
                          color='green'
                          onClick={handleSaveEdit}
                          loading={isUpdating}
                          disabled={isLoading}
                          data-testid={`collection-save-edit-${collection.id}`}
                        >
                          <IconCheck size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color='gray'
                          onClick={handleCancelEdit}
                          disabled={isLoading}
                          data-testid={`collection-cancel-edit-${collection.id}`}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    </>
                  ) : (
                    <>
                      <Group spacing='xs' style={{ flex: 1 }}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            backgroundColor: collection.color || '#228BE6',
                          }}
                        />
                        <Text>{collection.name}</Text>
                        <Text size='xs' color='dimmed'>
                          ({collection.documentCount} {collection.documentCount === 1 ? 'document' : 'documents'})
                        </Text>
                      </Group>
                      <Group spacing={4}>
                        <ActionIcon
                          onClick={() => handleStartEdit(collection)}
                          disabled={isLoading}
                          data-testid={`collection-start-edit-${collection.id}`}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color='red'
                          onClick={() => handleOpenDeleteModal(collection)}
                          disabled={isLoading}
                          data-testid={`collection-delete-${collection.id}`}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </>
                  )}
                </Group>
              ))}
            </Stack>
          )}
        </Box>

        <Group spacing='lg' position='right' mt='md'>
          <Button variant='outline' onClick={closeModalHandler}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>

    {deletingCollection && (
      <DeleteCollectionModal
        modalOpened={!!deletingCollection}
        closeModalHandler={handleCloseDeleteModal}
        collectionId={deletingCollection.id}
        collectionName={deletingCollection.name}
      />
    )}
    </>
  );
}
