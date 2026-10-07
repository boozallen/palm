import { useState } from 'react';
import { Button, Checkbox, Group, Modal, Text, Stack, TextInput, Select, Box, Anchor, Input } from '@mantine/core';
import { IconBrandGithub } from '@tabler/icons-react';

import { UiPreference } from '@/types/ui-preferences';
import { getGitHubBaseUrl } from '@/features/shared/utils/githubHelpers';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type GitHubProviderOption = {
  id: string;
  label: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
};

type PushToGithubModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  onConfirm: (providerId: string) => void;
  providers: GitHubProviderOption[];
  isLoading?: boolean;
}>;

export default function PushToGithubModal({
  modalOpened,
  closeModalHandler,
  onConfirm,
  providers,
  isLoading = false,
}: PushToGithubModalProps) {
  const [providerId, setProviderId] = useState('');
  const track = useTrackClientEvent();
  const suppressWarning = localStorage.getItem(UiPreference.SUPPRESS_GITHUB_PUSH_WARNING) === 'true';
  const [suppressChecked, setSuppressChecked] = useState(false);

  const selectedProvider = providers.find((p) => p.id === providerId) ?? (providers.length === 1 ? providers[0] : undefined);

  const handleConfirm = () => {
    if (suppressChecked) {
      localStorage.setItem(UiPreference.SUPPRESS_GITHUB_PUSH_WARNING, 'true');
    }
    onConfirm(selectedProvider?.id ?? '');
  };

  const baseUrl = getGitHubBaseUrl(selectedProvider?.apiBaseUrl ?? '');
  const repoUrl = selectedProvider ? `${baseUrl}/${selectedProvider.owner}/${selectedProvider.repo}` : '';

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Push to GitHub'
      centered
    >
      <Stack spacing='sm'>
        {providers.length === 1 ? (
          <Stack spacing='xs'>
            <Input.Label>GitHub Provider</Input.Label>
            <TextInput
              value={providers[0].label}
              readOnly
            />
          </Stack>
        ) : (
          <Select
            label='GitHub Provider'
            placeholder='Select GitHub provider'
            value={providerId || null}
            onChange={(value) => { if (value) { setProviderId(value); } }}
            data={providers.map((p) => ({ value: p.id, label: p.label }))}
          />
        )}
        {repoUrl && (
          <Stack spacing='xs'>
            <Input.Label>Repository</Input.Label>
            <Box
              p='sm'
              bg='dark.6'
              sx={{ borderRadius: '4px' }}
            >
              <Group spacing='xs' align='center'>
                <IconBrandGithub size={16} />
                <Anchor
                  href={repoUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={() => track.externalLink('GitHub repository', repoUrl)}
                  fz='xs'
                  sx={{ wordBreak: 'break-all' }}
                >
                  {repoUrl}
                </Anchor>
              </Group>
            </Box>
          </Stack>
        )}
        <Text color='gray.8' fz='xs' mt='xs' data-testid='github-push-disclaimer'>
          By proceeding, you acknowledge that this content will be made visible to anyone with access to that repository. Do not publish sensitive or confidential information.
        </Text>
        {!suppressWarning && (
          <Checkbox
            label='Do not show this message again'
            checked={suppressChecked}
            onChange={(e) => setSuppressChecked(e.currentTarget.checked)}
          />
        )}
        <Group spacing='lg' grow>
          <Button variant='outline' onClick={closeModalHandler} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={isLoading}
            disabled={isLoading || !selectedProvider}
          >
            Push to GitHub
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
