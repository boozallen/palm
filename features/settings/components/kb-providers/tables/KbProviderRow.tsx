import { KbProviderActionsMenu } from '@/features/settings/components/kb-providers/menus/KbProviderActionsMenu';
import { useDisclosure } from '@mantine/hooks';
import { Dispatch, SetStateAction } from 'react';
import { DisplayKnowledgeBaseRow } from './KbProvidersTable';
import { Group } from '@mantine/core';
import DeleteKbProviderModal from '@/features/settings/components/kb-providers/modals/DeleteKbProviderModal';
import EditKbProviderModal from '@/features/settings/components/kb-providers/modals/EditKbProviderModal';

type KbProvider = {
  id: string;
  label: string;
  updatedAt: string;
};

type KbProvidersRowProps = Readonly<{
  kbProvider: KbProvider;
  setShowAddKnowledgeBaseRow: Dispatch<SetStateAction<DisplayKnowledgeBaseRow>>;
}>;

export default function KbProviderRow({
  kbProvider,
  setShowAddKnowledgeBaseRow,
}: KbProvidersRowProps) {
  const [
    editKbProviderModalOpened,
    { open: openEditKbProviderModal, close: closeEditKbProviderModal },
  ] = useDisclosure(false);

  const [
    deleteKbProviderModalOpened,
    { open: openDeleteKbProviderModal, close: closeDeleteKbProviderModal },
  ] = useDisclosure(false);

  const handleShowAddKnowledgeBaseRow = () => {
    setShowAddKnowledgeBaseRow({
      isVisible: true,
      kbProviderId: kbProvider.id,
    });
  };

  return (
    <>
      <EditKbProviderModal
        kbProviderId={kbProvider.id}
        modalOpen={editKbProviderModalOpened}
        closeModalHandler={closeEditKbProviderModal}
      />
      <DeleteKbProviderModal
        kbProviderId={kbProvider.id}
        modalOpened={deleteKbProviderModalOpened}
        closeModalHandler={closeDeleteKbProviderModal}
      />

      <tr>
        <td>{kbProvider.label}</td>
        <td></td>
        <td></td>
        <td>
          <Group position='right'>
            <KbProviderActionsMenu
              kbProviderId={kbProvider.id}
              kbProviderLabel={kbProvider.label}
              onAddKnowledgeBaseClick={handleShowAddKnowledgeBaseRow}
              onEditClick={openEditKbProviderModal}
              onDeleteClick={openDeleteKbProviderModal}
            />
          </Group>
        </td>
      </tr>
    </>
  );
}
