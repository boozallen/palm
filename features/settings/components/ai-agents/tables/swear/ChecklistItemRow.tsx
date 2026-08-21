import { useDisclosure } from '@mantine/hooks';
import { ActionIcon, Group } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';

import { ChecklistItemForm } from '@/features/settings/types';
import DeleteChecklistItemModal from '@/features/settings/components/ai-agents/modals/swear/DeleteChecklistItemModal';
import { SwearChecklistItem } from '@/features/shared/types';
import EditChecklistItemModal from '@/features/settings/components/ai-agents/modals/swear/EditChecklistItemModal';

type ChecklistItemRowProps = Readonly<{
  checklistItem: SwearChecklistItem;
}>;

export default function ChecklistItemRow({ checklistItem }: ChecklistItemRowProps) {
  const [
    editChecklistItemModalOpened,
    { open: openEditChecklistItemModal, close: closeEditChecklistItemModal },
  ] = useDisclosure(false);

  const [
    deleteChecklistItemModalOpened,
    { open: openDeleteChecklistItemModal, close: closeDeleteChecklistItemModal },
  ] = useDisclosure(false);

  const checklistItemFormValues: ChecklistItemForm = {
    category: checklistItem.category,
    item: checklistItem.item,
    sortOrder: checklistItem.sortOrder,
  };

  return (
    <>
      <EditChecklistItemModal
        isOpened={editChecklistItemModalOpened}
        closeModal={closeEditChecklistItemModal}
        checklistItemId={checklistItem.id}
        initialValues={checklistItemFormValues}
      />
      <DeleteChecklistItemModal
        itemId={checklistItem.id}
        modalOpened={deleteChecklistItemModalOpened}
        closeModalHandler={closeDeleteChecklistItemModal}
      />

      <tr>
        <td>{checklistItem.category}</td>
        <td>{checklistItem.item}</td>
        <td>{checklistItem.sortOrder}</td>
        <td>
          <Group spacing='xs' noWrap>
            <ActionIcon
              aria-label='Edit checklist item'
              onClick={openEditChecklistItemModal}
            >
              <IconPencil />
            </ActionIcon>
            <ActionIcon
              aria-label='Delete checklist item'
              onClick={openDeleteChecklistItemModal}
            >
              <IconTrash />
            </ActionIcon>
          </Group>
        </td>
      </tr>
    </>
  );
}
