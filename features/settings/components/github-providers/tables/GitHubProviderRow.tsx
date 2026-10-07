import { ActionIcon, Anchor, Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconRefresh } from '@tabler/icons-react';
import { GitHubProviderActionsMenu } from '@/features/settings/components/github-providers/menus/GitHubProviderActionsMenu';
import EditGitHubProviderModal from '@/features/settings/components/github-providers/modals/EditGitHubProviderModal';
import DeleteGitHubProviderModal from '@/features/settings/components/github-providers/modals/DeleteGitHubProviderModal';
import useRefreshSkillRepo from '@/features/settings/api/github-providers/refresh-repo';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import { notifications } from '@mantine/notifications';

type GitHubProvider = {
  id: string;
  label: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
  description: string;
  isSkillRepo: boolean;
  skillRepoBranch: string | null;
  skillRepoServiceUrl: string | null;
  skillRepoLastSyncAt: string | null;
  skillRepoLastSyncCommit: string | null;
};

type GitHubProviderRowProps = {
  provider: GitHubProvider;
};

export default function GitHubProviderRow({ provider }: Readonly<GitHubProviderRowProps>) {
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const { mutateAsync: refreshSkillRepo, isPending: isRefreshing } = useRefreshSkillRepo();
  const track = useTrackClientEvent();

  const handleRefresh = async () => {
    try {
      const result = await refreshSkillRepo({ githubProviderId: provider.id });
      if (result.success) {
        notifications.show({
          title: 'Skill Repository Refreshed',
          message: `Successfully synced to commit ${result.commit?.substring(0, 7)}`,
          variant: 'successful_operation',
        });
      } else {
        notifications.show({
          title: 'Refresh Failed',
          message: result.error || 'Unknown error',
          variant: 'failed_operation',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Refresh Failed',
        message: (error as Error).message,
        variant: 'failed_operation',
      });
    }
  };

  const formatLastSync = (date: string | null) => {
    if (!date) { return 'Never'; }
    const now = new Date();
    const syncDate = new Date(date);
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) { return 'Just now'; }
    if (diffMins < 60) { return `${diffMins}m ago`; }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) { return `${diffHours}h ago`; }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getCommitUrl = (commit: string) => {
    const baseUrl = provider.apiBaseUrl.replace('/api/v3', '').replace('api.github.com', 'github.com');
    return `${baseUrl}/${provider.owner}/${provider.repo}/commit/${commit}`;
  };

  return (
    <>
      <EditGitHubProviderModal
        providerId={provider.id}
        currentLabel={provider.label}
        currentApiBaseUrl={provider.apiBaseUrl}
        currentOwner={provider.owner}
        currentRepo={provider.repo}
        currentDescription={provider.description}
        currentIsSkillRepo={provider.isSkillRepo}
        currentSkillRepoBranch={provider.skillRepoBranch}
        currentSkillRepoServiceUrl={provider.skillRepoServiceUrl}
        modalOpen={editOpened}
        closeModalHandler={closeEdit}
      />
      <DeleteGitHubProviderModal
        providerId={provider.id}
        modalOpened={deleteOpened}
        closeModalHandler={closeDelete}
      />
      <tr>
        <td>
          <Group spacing='xs'>
            <Text fw={500}>{provider.label}</Text>
            {provider.isSkillRepo && (
              <Badge size='xs' variant='light' color='blue'>
                Skill Repository
              </Badge>
            )}
          </Group>
        </td>
        <td>
          <Text fz='sm' c='dimmed' style={{ wordBreak: 'break-all' }}>{provider.apiBaseUrl}</Text>
        </td>
        <td>
          <Text c='dimmed' fz='sm'>{provider.description || '—'}</Text>
        </td>
        <td>
          {provider.isSkillRepo && (
            <Group spacing='xs' align='flex-start'>
              <Stack spacing={4}>
                <Group spacing={4}>
                  <Text fz='xs' c='dimmed' fw={500}>
                    Sync date:
                  </Text>
                  <Text fz='xs' c='dimmed'>
                    {formatLastSync(provider.skillRepoLastSyncAt)}
                  </Text>
                </Group>
                <Group spacing={4}>
                  <Text fz='xs' c='dimmed' fw={500}>
                    Sync commit:
                  </Text>
                  {provider.skillRepoLastSyncCommit ? (
                    <Anchor
                      href={getCommitUrl(provider.skillRepoLastSyncCommit)}
                      target='_blank'
                      rel='noopener noreferrer'
                      onClick={() => track.externalLink(
                        `Sync commit ${provider.skillRepoLastSyncCommit!.substring(0, 7)}`,
                        getCommitUrl(provider.skillRepoLastSyncCommit!),
                      )}
                      fz='xs'
                      c='blue'
                    >
                      {provider.skillRepoLastSyncCommit.substring(0, 7)}
                    </Anchor>
                  ) : (
                    <Text fz='xs' c='dimmed'>
                      Not synced
                    </Text>
                  )}
                </Group>
              </Stack>
              <Tooltip label='Refresh skill repository'>
                <ActionIcon
                  size='sm'
                  variant='subtle'
                  loading={isRefreshing}
                  onClick={handleRefresh}
                  aria-label='Refresh skill repository'
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </td>
        <td>
          <Group position='right'>
            <GitHubProviderActionsMenu
              onEditClick={openEdit}
              onDeleteClick={openDelete}
            />
          </Group>
        </td>
      </tr>
    </>
  );
}
