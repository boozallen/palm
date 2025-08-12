import { ActionIcon, Group } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import EditKnowledgeBaseForm from '@/features/settings/components/kb-providers/forms/EditKnowledgeBaseForm';
import DeleteKnowledgeBaseModal from '@/features/settings/components/kb-providers/modals/DeleteKnowledgeBaseModal';
import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';

type KnowledgeBase = {
  id: string;
  label: string;
  externalId: string;
  kbProviderId: string;
  updatedAt: Date;
};

type KnowledgeBaseRowProps = Readonly<{
  knowledgeBase: KnowledgeBase;
}>;

export default function KnowledgeBaseRow({
  knowledgeBase,
}: KnowledgeBaseRowProps) {
  const [editKnowledgeBase, setEditKnowledgeBase] = useState<boolean>(false);

  const handleEditKnowledgeBase = () => {
    setEditKnowledgeBase(true);
  };

  const [
    deleteKnowledgeBaseModalOpened,
    {
      open: openDeleteKnowledgeBaseModal,
      close: closeDeleteKnowledgeBaseModal,
    },
  ] = useDisclosure(false);

  return (
    <>
      <DeleteKnowledgeBaseModal
        modalOpen={deleteKnowledgeBaseModalOpened}
        closeModalHandler={closeDeleteKnowledgeBaseModal}
        knowledgeBaseId={knowledgeBase.id}
      />
      <tr className='provider-model-row'>
        {editKnowledgeBase ? (
          <td colSpan={4}>
            <EditKnowledgeBaseForm
              id={knowledgeBase.id}
              label={knowledgeBase.label}
              externalId={knowledgeBase.externalId}
              setEditKnowledgeBase={setEditKnowledgeBase}
            />
          </td>
        ) : (
          <>
            <td></td>
            <td>{knowledgeBase.label}</td>
            <td>{knowledgeBase.externalId}</td>
            <td>
              <Group>
                <ActionIcon
                  data-testid={`${knowledgeBase.id}-edit`}
                  onClick={handleEditKnowledgeBase}
                  aria-label='Edit knowledge base'
                >
                  <IconPencil />
                </ActionIcon>
                <ActionIcon
                  data-testid={`${knowledgeBase.id}-delete`}
                  onClick={openDeleteKnowledgeBaseModal}
                  aria-label='Delete knowledge base'
                >
                  <IconTrash />
                </ActionIcon>
              </Group>
            </td>
          </>
        )}
      </tr>
    </>
  );
}
