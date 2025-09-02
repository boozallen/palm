import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';
import { UserRole } from '@/features/shared/types/user';
import { useSession } from 'next-auth/react';
import AddUserGroupModal from '@/features/settings/components/user-groups/modals/AddUserGroupModal';
import UserGroupsAsLeadTable from '@/features/settings/components/user-groups/tables/UserGroupsAsLeadTable';
import UserGroupsAsAdminTable from '@/features/settings/components/user-groups/tables/UserGroupsAsAdminTable';

export default function UserGroups() {
  const session = useSession();
  const userRole = session.data?.user.role;

  const [
    addUserGroupModalOpened,
    { open: openAddUserGroupModal, close: closeAddUserGroupModal },
  ] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      {userRole === UserRole.Admin &&
        <AddUserGroupModal
          modalOpen={addUserGroupModalOpened}
          closeModalHandler={closeAddUserGroupModal}
        />
      }

      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          User Groups
        </Title>

        {userRole === UserRole.Admin &&
          <ActionIcon
            variant='system_management'
            data-testid='create-user-group-button'
            onClick={openAddUserGroupModal}
            aria-label='Create user group'
          >
            <IconCirclePlus />
          </ActionIcon>
        }
      </Group>

      {userRole === UserRole.Admin
        ?
        <UserGroupsAsAdminTable />
        :
        <UserGroupsAsLeadTable />
      }
    </Stack>
  );
}
