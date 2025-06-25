import { ThemeIcon, UnstyledButton } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import DeletePromptModal from '@/features/library/components/modals/DeletePromptModal';
import { useDisclosure } from '@mantine/hooks';

type DeletePromptIconProps = Readonly<{
  id: string
}>;

export default function DeletePromptIcon({ id }: DeletePromptIconProps) {

  const [
    deletePromptModalOpened,
    { open: openDeletePromptModal, close: closeDeletePromptModal },
  ] = useDisclosure(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDeletePromptModal();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      openDeletePromptModal();
    }
    event.stopPropagation();
  };

  return (
    <>
      <DeletePromptModal
        modalOpened={deletePromptModalOpened}
        closeModalHandler={closeDeletePromptModal}
        promptId={id}
      />
      
      <UnstyledButton
        onClick={handleDelete}
        aria-label='delete prompt'
        onKeyDown={handleKeyDown}
      >
        <ThemeIcon>
          <IconTrash />
        </ThemeIcon>
      </UnstyledButton>
    </>
  );
}
