import { Group } from '@mantine/core';
import { AiProviderActionsMenu } from '@/features/settings/components/ai-providers/menus/AiProviderActionsMenu';
import EditAiProviderModal from '@/features/settings/components/ai-providers/modals/EditAiProviderModal';
import DeleteAiProviderModal from '@/features/settings/components/ai-providers/modals/DeleteAiProviderModal';
import { useDisclosure } from '@mantine/hooks';
import { Dispatch, SetStateAction } from 'react';
import { ShowModelRowType } from './AiProvidersTableBody';

type AiProvider = {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

type ProviderRowProps = Readonly<{
  provider: AiProvider;
  setShowAddModelRow: Dispatch<SetStateAction<ShowModelRowType>>;
}>;

export default function ProviderRow({
  provider,
  setShowAddModelRow,
}: ProviderRowProps) {

  const [
    editAiProviderModalOpened,
    { open: openEditAiProviderModal, close: closeEditAiProviderModal },
  ] = useDisclosure(false);

  const [
    deleteAiProviderModalOpened,
    { open: openDeleteAiProviderModal, close: closeDeleteAiProviderModal },
  ] = useDisclosure(false);

  const handleShowAddModelRow = () => {
    setShowAddModelRow({ show: true, providerId: provider.id });
  };

  return (
    <>
      <EditAiProviderModal
        aiProviderId={provider.id}
        modalOpen={editAiProviderModalOpened}
        closeModalHandler={closeEditAiProviderModal}
      />

      <DeleteAiProviderModal
        aiProviderId={provider.id}
        modalOpened={deleteAiProviderModalOpened}
        closeModalHandler={closeDeleteAiProviderModal}
      />

      <tr data-testid={`${provider.id}-provider-row`}>
        <td>{provider.label}</td>
        <td colSpan={4}></td>
        <td>
          <Group position='right'>
            <AiProviderActionsMenu
              providerId={provider.id}
              providerLabel={provider.label}
              onAddModelClick={handleShowAddModelRow}
              onEditClick={openEditAiProviderModal}
              onDeleteClick={openDeleteAiProviderModal}
            />
          </Group>
        </td>
      </tr>
    </>
  );
}
