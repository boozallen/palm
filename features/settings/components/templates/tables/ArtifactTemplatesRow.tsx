import { ActionIcon, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash } from '@tabler/icons-react';

import DeleteTemplateModal from '@/features/settings/components/templates/modals/DeleteTemplateModal';

type ArtifactTemplatesRowProps = Readonly<{
  id: string;
  filename: string;
  createdAt: string | Date;
}>;

export default function ArtifactTemplatesRow({ id, filename, createdAt }: ArtifactTemplatesRowProps) {
  const [
    deleteModalOpened,
    { open: openDeleteModal, close: closeDeleteModal },
  ] = useDisclosure(false);

  const formattedDate = new Date(createdAt).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });

  const extension = filename.split('.').pop() ?? '';

  return (
    <>
      <DeleteTemplateModal
        id={id}
        name={filename}
        modalOpened={deleteModalOpened}
        closeModalHandler={closeDeleteModal}
      />
      <tr>
        <td>{filename}</td>
        <td>
          <Text tt='uppercase' fz='xs' c='gray.5'>{extension}</Text>
        </td>
        <td>{formattedDate}</td>
        <td>
          <ActionIcon
            data-testid='delete-template-button'
            onClick={openDeleteModal}
            aria-label={`Delete template ${filename}`}
          >
            <IconTrash />
          </ActionIcon>
        </td>
      </tr>
    </>
  );
}
