import { ChangeEvent } from 'react';
import { Button, Checkbox, Group, Modal, Text } from '@mantine/core';

import useRegenerateResponse from '@/features/chat/hooks/useRegenerateResponse';
import { UiPreference } from '@/types/ui-preferences';

type RegenerateResponseModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  messageId: string;
}>;

export default function RegenerateResponseModal({
  modalOpened,
  closeModalHandler,
  messageId,
}: RegenerateResponseModalProps) {
  const { mutateAsync: regenerateResponse } = useRegenerateResponse(messageId);

  const updateRegenerateResponseCookie = (e: ChangeEvent<HTMLInputElement>) => {
    localStorage.setItem(UiPreference.SUPPRESS_REGENERATE_RESPONSE_WARNING, String(e.currentTarget.checked));
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Regenerate Response'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        This will remove the selected response and all subsequent messages.
        Are you sure you want to continue?
      </Text>
      <Checkbox mb='md' label='Do not show this message again' onChange={updateRegenerateResponseCookie}/>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={regenerateResponse}>Continue</Button>
      </Group>
    </Modal>
  );

}
