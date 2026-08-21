import { Select, ActionIcon, Tooltip, Box } from '@mantine/core';
import { IconFolders, IconFolder } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';
import ManageCollectionsModal from '@/features/shared/components/document-library/modals/ManageCollectionsModal';

type CollectionFilterProps = {
  selectedCollectionId: string | null;
  onCollectionChange: (collectionId: string | null) => void;
};

export default function CollectionFilter({
  selectedCollectionId,
  onCollectionChange,
}: CollectionFilterProps) {
  const { data: collectionsData } = useGetCollections();
  const [manageModalOpened, { open: openManageModal, close: closeManageModal }] = useDisclosure();

  const collections = collectionsData?.collections || [];

  const selectData = [
    { value: 'all', label: 'All Documents', group: 'Default' },
    ...collections.map((collection) => ({
      value: collection.id,
      label: `${collection.name} (${collection.documentCount})`,
      group: 'Collections',
    })),
  ];

  return (
    <>
      <ManageCollectionsModal modalOpened={manageModalOpened} closeModalHandler={closeManageModal} />

      <Box mb='sm' sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Select
          placeholder='Filter by collection'
          data={selectData}
          value={selectedCollectionId || 'all'}
          onChange={(value) => {
            onCollectionChange(value === 'all' ? null : value);
          }}
          icon={<IconFolder size={16} />}
          size='xs'
          styles={(theme) => ({
            root: { flex: 1 },
            item: {
              '&[data-selected]': {
                backgroundColor: theme.colors.blue[9],
              },
            },
          })}
          searchable
          clearable={false}
        />

        <Tooltip label='Manage collections' withArrow>
          <ActionIcon
            size='md'
            variant='subtle'
            onClick={openManageModal}
            aria-label='Manage collections'
            sx={(theme) => ({
              '&:hover': {
                backgroundColor: theme.colors.dark[5],
              },
            })}
          >
            <IconFolders size={18} />
          </ActionIcon>
        </Tooltip>
      </Box>
    </>
  );
}
