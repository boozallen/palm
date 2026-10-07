import { useState } from 'react';
import {
  Button,
  Group,
  Paper,
  Stack,
  Tooltip,
  Text,
  ThemeIcon,
  ActionIcon,
  CopyButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconRefresh, IconKey } from '@tabler/icons-react';
import useGenerateUserGroupJoinCode from '@/features/settings/api/user-groups/generate-user-group-join-code';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type UserGroupJoinCodeProps = Readonly<{
  id: string;
  currentJoinCode: string | null | undefined;
}>;

export default function UserGroupJoinCode({
  id,
  currentJoinCode,
}: UserGroupJoinCodeProps) {
  const [joinCode, setJoinCode] = useState(currentJoinCode);
  const hasJoinCode = joinCode && joinCode.trim() !== '';

  const track = useTrackClientEvent();

  const {
    mutate: generateUserGroupJoinCode,
    isPending: generateUserGroupJoinCodeIsPending,
  } = useGenerateUserGroupJoinCode();

  const handleGenerate = () => {
    generateUserGroupJoinCode(
      { userGroupId: id },
      {
        onSuccess: (data) => {
          if (data.joinCode) {
            setJoinCode(data.joinCode);
            notifications.show({
              id: 'generate-join-code-success',
              title: !joinCode
                ? 'Join Code Generated'
                : 'Join Code Regenerated',
              message: !joinCode
                ? 'Successfully generated user group join code.'
                : 'Successfully regenerated user group join code.',
              icon: <IconCheck />,
              variant: 'successful_operation',
            });
          }
        },
        onError: (error) => {
          notifications.show({
            id: 'generate-join-code-error',
            title: 'Failed to Generate Group Join Code',
            message:
              error.message ||
              'Unable to generate group join code. Please try again later.',
            icon: <IconX />,
            variant: 'failed_operation',
            autoClose: false,
          });
        },
      }
    );
  };

  return (
    <Paper
      p='md'
      withBorder
      radius='md'
      bg='dark.7'
      data-testid='user-group-join-code-container'
    >
      <Stack spacing='sm'>
        <Group spacing='xs'>
          <ThemeIcon
            variant='light'
            color='gray'
            size='md'
            radius='sm'
            sx={{ pointerEvents: 'none' }}
          >
            <IconKey size={16} />
          </ThemeIcon>
          <Text
            size='sm'
            weight={600}
            color='gray.1'
            data-testid='user-group-join-code-label'
          >
            Join Code
          </Text>
        </Group>

        <Group spacing='xs'>
          <CopyButton
            value={joinCode ?? 'None'}
            data-testid='user-group-join-code-copy-button'
          >
            {({ copied, copy }) => (
              <Tooltip
                label={copied ? 'Copied' : 'Copy'}
                withArrow
                position='right'
              >
                <Button
                  w='xxxl'
                  color={copied ? 'teal' : 'blue'}
                  onClick={() => {
                    copy();
                    track.copy.content('user group join code');
                  }}
                  disabled={!hasJoinCode}
                >
                  {joinCode ?? 'None'}
                </Button>
              </Tooltip>
            )}
          </CopyButton>

          <Tooltip
            label='Generate join code for this user group'
            withArrow
            position='top'
            disabled={!!hasJoinCode}
          >
            <ActionIcon
              variant='system_management'
              data-testid='generate-user-group-join-code-button'
              onClick={handleGenerate}
              aria-label={
                hasJoinCode
                  ? 'Regenerate user group join code'
                  : 'Generate user group join code'
              }
              loading={generateUserGroupJoinCodeIsPending}
            >
              <IconRefresh />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Text size='xs' color='gray.6'>
          Anyone with this code can join the user group. Regenerating invalidates it.
        </Text>
      </Stack>
    </Paper>
  );
}
