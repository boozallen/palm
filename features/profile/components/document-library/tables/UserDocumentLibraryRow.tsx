import { ActionIcon } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

type UserDocument = {
  id: string;
  userId: string;
  label: string;
  uploadedAt: string;
};

type UserDocumentLibraryRowProps = Readonly<{
  document: UserDocument;
}>;

export default function UserDocumentLibraryRow(
  { document }: UserDocumentLibraryRowProps
) {

  const formattedDate = new Date(
    document.uploadedAt
  ).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });

  return (
    <tr>
      <td>{document.label}</td>
      <td>{formattedDate}</td>
      <td>
        <ActionIcon data-testid={`${document.id}-delete-document`} aria-label='Delete document'>
          <IconTrash />
        </ActionIcon>
      </td>
    </tr>
  );
}
