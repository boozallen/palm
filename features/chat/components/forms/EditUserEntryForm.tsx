import { ActionIcon, Box, Group, Textarea } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { useFocusTrap } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';

import { useChat } from '@/features/chat/providers/ChatProvider';
import { editEntryForm, EditEntryForm, MessageEntry } from '@/features/chat/types/entry';
import useEditMessage from '@/features/chat/hooks/useEditMessage';
import { selectedTextSentParser } from '@/features/chat/utils/selectedTextHelperFunctions';

type EditUserEntryFormProps = Readonly<{
  entry: MessageEntry;
}>;

export function EditUserEntryForm({ entry }: EditUserEntryFormProps) {
  const { setEntryBeingEdited, setRegeneratingResponse } = useChat();
  const { userMessage } = selectedTextSentParser(entry.content);
  const focusTrap = useFocusTrap();
  const { mutateAsync: editMessage, isPending: editMessageIsPending } = useEditMessage(entry.id);

  const form = useForm<EditEntryForm>({
    initialValues: {
      message: userMessage,
    },
    validate: zodResolver(editEntryForm),
  });

  const handleCancel = () => {
    setEntryBeingEdited(null);
  };

  const handleSubmit = async (values: EditEntryForm) => {
    try {
      setRegeneratingResponse(true);
      await editMessage(values.message);
    } catch (error) {
      let message = 'An unexpected error occurred. Please try again later.';

      if (error instanceof Error || error instanceof TRPCClientError) {
        message = error.message;
      }

      notifications.show({
        title: 'Something Went Wrong',
        message,
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Box component='form' ref={focusTrap} onSubmit={form.onSubmit(handleSubmit)}>
      <Textarea
        aria-label='Write your updated message here'
        placeholder='Type something here...'
        autoFocus
        autosize
        minRows={1}
        maxRows={8}
        mb='sm'
        radius='md'
        styles={(theme) => ({
          input: {
            border: `1px solid ${theme.colors.dark[1]}`,
            padding: `${theme.spacing.md}!important`,
          },
        })}
        {...form.getInputProps('message')}
      />
      <Group position='right' spacing='xs'>
        <ActionIcon
          onClick={handleCancel}
          size='sm'
          aria-label='Cancel editing message'
          disabled={editMessageIsPending}
        >
          <IconX />
        </ActionIcon>
        <ActionIcon
          type='submit'
          aria-label='Save edited message'
          loading={editMessageIsPending}
        >
          <IconCheck />
        </ActionIcon>
      </Group>
    </Box>
  );
}
