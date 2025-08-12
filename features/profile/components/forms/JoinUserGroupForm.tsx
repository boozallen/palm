import { Box, Button, Group, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';

import { JoinUserGroup, joinUserGroupSchema } from '@/features/profile/types/userGroup';
import useJoinUserGroupViaJoinCode from '@/features/profile/api/join-user-group-via-join-code';

type JoinUserGroupFormProps = Readonly<{
  closeModalHandler?: () => void;
}>;

export default function JoinUserGroupForm({
  closeModalHandler,
}: JoinUserGroupFormProps) {
  
  const {
    mutateAsync: joinUserGroup,
  } = useJoinUserGroupViaJoinCode();

  const joinUserGroupForm = useForm<JoinUserGroup>({
    initialValues: {
      code: '',
    },
    validate: zodResolver(joinUserGroupSchema),
  });

  const handleSubmit = async (values: JoinUserGroup) => {
    try {
      const userGroup = await joinUserGroup({
        joinCode: values.code,
      });

      notifications.show({
        id: 'join_user_group_success',
        title: 'Successfully Added to Group',
        message: `You have successfully joined the ${userGroup.label} user group.`,
        icon: <IconCheck />,
        autoClose: false,
        variant: 'successful_operation',
      });

      resetForm();
    } catch (error) {
      let message: string | null = null;
      if (error instanceof Error || error instanceof TRPCClientError) {
        message = error.message;
      }

      notifications.show({
        id: 'join_user_group_failure',
        title: 'Failed to Join User Group',
        message: message ?? 'Could not join user group. Please try again later.',
        icon: <IconX />,
        autoClose: false,
        variant: 'failed_operation',
      });
    }
  };

  const resetForm = () => {
    joinUserGroupForm.reset();
    if (closeModalHandler) {
      closeModalHandler();
    }
  };

  return (
    <Box component='form' onSubmit={joinUserGroupForm.onSubmit(handleSubmit)}>
      <Group align='center'>
        <TextInput
          data-autofocus
          placeholder='Enter join code here'
          aria-label='User Group Join Code'
          {...joinUserGroupForm.getInputProps('code')}
          mb='0'
        />
        <Button
          type='submit'
          disabled={!joinUserGroupForm.isValid()}
        >
          Join User Group
        </Button>
      </Group>
    </Box>
  );
}
