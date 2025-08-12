import { ActionIcon, Indicator, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

import { Document, uploadStatusColorCode } from '@/features/shared/types/document';
import DeletePersonalDocumentModal from '@/features/profile/components/document-library/modals/DeletePersonalDocumentModal';

type DocumentLibraryRowProps = Readonly<{
  document: Document;
}>;

export default function DocumentLibraryRow({ document }: DocumentLibraryRowProps) {

  const [
    deletePersonalDocumentModalOpened,
    { open: openDeletePersonalDocumentModal, close: closeDeletePersonalDocumentModal },
  ] = useDisclosure(false);

  const formattedDate = new Date(document.createdAt).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });

  return (
    <>
      <DeletePersonalDocumentModal
        modalOpened={deletePersonalDocumentModalOpened}
        closeModalHandler={closeDeletePersonalDocumentModal}
        documentId={document.id}
      />

      <tr>
        <td>{document.filename}</td>
        <td>{formattedDate}</td>
        <td>
          <Indicator
            ml='sm'
            inline
            position='middle-start'
            color={uploadStatusColorCode[document.uploadStatus]}
          >
            <Text ml='md'>
              {document.uploadStatus}
            </Text>
          </Indicator>
        </td>
        <td>
          <ActionIcon
            aria-label={`Delete document ${document.id}`}
            onClick={openDeletePersonalDocumentModal}
          >
            <IconTrash />
          </ActionIcon>
        </td>
      </tr>
    </>
  );
}

