import { ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';

import RemoveAdminModal from '@/features/settings/components/admins/modals/RemoveAdminModal';

type AdminsRowProps = Readonly<{
  id: string;
  name: string;
  email: string;
}>

export default function AdminsRow({ id, name, email }: AdminsRowProps) {

  const [
    removeAdminModalOpened,
    { open: openRemoveAdminModal, close: closeRemoveAdminModal },
  ] = useDisclosure(false);

  const session = useSession();

  return (
    <>
      <RemoveAdminModal
        id={id}
        name={name}
        modalOpened={removeAdminModalOpened}
        closeModalHandler={closeRemoveAdminModal}
      />

      <tr>
        <td>{name}</td>
        <td>{email}</td>
        <td>
          {session.data?.user.id !== id && (
            <ActionIcon
              data-testid='remove-admin-button'
              onClick={openRemoveAdminModal}
            >
              <IconTrash />
            </ActionIcon>
          )}
        </td>
      </tr>
    </>
  );
}
