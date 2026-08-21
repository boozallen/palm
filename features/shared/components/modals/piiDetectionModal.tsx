import { ChangeEvent } from 'react';
import { Button, Checkbox, Group, Modal, Text, List } from '@mantine/core';

import { DetectedPii } from '@/features/shared/types/pii';
import { UiPreference } from '@/types/ui-preferences';

type PiiDetectionModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  onContinue: () => void;
  piiMatches: DetectedPii[];
}>;

export default function PiiDetectionModal({
  modalOpened,
  closeModalHandler,
  onContinue,
  piiMatches,
}: PiiDetectionModalProps) {
  const updatePiiDetectionCookie = (e: ChangeEvent<HTMLInputElement>) => {
    localStorage.setItem(UiPreference.SUPPRESS_PII_WARNING, String(e.currentTarget.checked));
  };

  const handleContinue = () => {
    onContinue();
    closeModalHandler();
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Possible PII Detected'
      centered
    >
      <Text color='gray.7' fz='sm'>
        Potential instance{piiMatches.length === 1 ? '' : 's'} of PII detected in your message:
      </Text>
      
      <List size='sm' p='sm' spacing='xxs' style={{ listStyleType: 'disc' }}>
        {piiMatches.map((match, index) => (
          <List.Item key={index}>
            <Group spacing='sm' p='xxs' noWrap grow>
              <Text size='sm' color='red.6' style={{ fontFamily: 'monospace' }}>
                {match.content}
              </Text>
              <Text size='xs' color='gray.6'>
                (position: {match.startIndex})
              </Text>
            </Group>
          </List.Item>
        ))}
      </List>
      
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to submit this message?
      </Text>
      
      <Checkbox mb='md' label='Do not show this warning again' onChange={updatePiiDetectionCookie} />
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleContinue}>Continue</Button>
      </Group>
    </Modal>
  );
}
