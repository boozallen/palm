import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';
import GitHubProvidersTable from './tables/GitHubProvidersTable';
import AddGitHubProviderModal from './modals/AddGitHubProviderModal';

export default function GitHubProviders() {
  const [addModalOpened, { open: openAddModal, close: closeAddModal }] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <AddGitHubProviderModal modalOpen={addModalOpened} closeModalHandler={closeAddModal} />

      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          GitHub Providers
        </Title>
        <ActionIcon
          variant='system_management'
          data-testid='add-github-provider-button'
          onClick={openAddModal}
          aria-label='Add GitHub provider'
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <GitHubProvidersTable />
    </Stack>
  );
}
