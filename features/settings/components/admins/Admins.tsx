import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';

import AdminsTable from './tables/AdminsTable';
import AddAdminModal from './modals/AddAdminModal';

export default function Admins() {

  const [
    addAdminModalOpened,
    { open: openAddAdminModal, close: closeAddAdminModal },
  ] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <AddAdminModal
        modalOpened={addAdminModalOpened}
        closeModalHandler={closeAddAdminModal}
      />
      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          Admins
        </Title>
        <ActionIcon
          variant='system_management'
          data-testid='add-admin-button'
          onClick={openAddAdminModal}
          aria-label='Add admin'
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <AdminsTable />
    </Stack>
  );
}
