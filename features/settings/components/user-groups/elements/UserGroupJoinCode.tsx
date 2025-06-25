import { useState } from 'react';
import {
  Button,
  Group,
  Tooltip,
  Title,
  ActionIcon,
  CopyButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconRefresh } from '@tabler/icons-react';
import useGenerateUserGroupJoinCode from '@/features/settings/api/generate-user-group-join-code';

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
    <Group position='right' data-testid='user-group-join-code-container'>
      <Title
        weight='bold'
        color='gray.6'
        order={2}
        data-testid='user-group-join-code-label'
      >
        Join Code:
      </Title>

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
              onClick={copy}
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
  );
}
