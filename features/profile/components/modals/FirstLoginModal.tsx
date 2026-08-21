import { Anchor, Box, Modal, Text, Title } from '@mantine/core';
import React from 'react';
import JoinUserGroupForm from '@/features/profile/components/forms/JoinUserGroupForm';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type FirstLoginModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
}>;

export default function FirstLoginModal({ modalOpened, closeModalHandler }: FirstLoginModalProps) {
  const { data: systemConfig } = useGetSystemConfig();
  const track = useTrackClientEvent();

  const requestAccessUrl = systemConfig?.joinUserGroupDialogExternalLink ?? '';

  // The link opens in a new tab, so the click is not intercepted; both records
  // are fired alongside it. They answer different questions and are tracked
  // separately: EXTERNAL_NAVIGATION counts the click as a link leaving the app
  // (Context Studio behavior views), REQUEST_ACCESS_TO_PALM counts it as an
  // access-request intent (governance).
  const handleRequestAccessClick = () => {
    track.externalLink('see how to get access on the PALM site', requestAccessUrl);
    track.requestAccess('First Login Modal', requestAccessUrl);
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      closeOnClickOutside
      data-testid='first-login-modal'
      title='Welcome to Prompt & Agent Library Marketplace (PALM)'
      padding='lg'
      size='lg'
      centered
      transitionProps={{ transition: 'fade', duration: 200 }}
      styles={(theme) => ({
        content: {
          // Override the global Modal theme's `border` shorthand which resets the top edge.
          borderTop: `4px solid ${theme.colors.orange[6]} !important`,
        },
      })}
    >
      <Title order={3} color='gray.6' mb='sm'>Getting Started</Title>
      <Text color='gray.7' align='left' size='sm'>
        To access the appropriate workspace and LLM resources, you must belong to at least <b>1</b> user group.
        You will need a <b>join code</b> to become a member of a specific group.
      </Text>

      <Title order={3} color='gray.6' my='sm'>How to Obtain a Join Code</Title>
      <Text color='gray.7' align='left' size='sm' my='sm' data-testid='first-login-modal-get-access'>
        You should have already received a join code from your group lead or manager.
        {requestAccessUrl ? (
          <Text span inherit data-testid='first-login-modal-ai-risk-trigger'>
            {' '}If not, you will need an approved AI Risk Trigger request before we can add you to a user group: {' '}
            <Anchor
              href={requestAccessUrl}
              target='_blank'
              rel='noopener noreferrer'
              onClick={handleRequestAccessClick}
              data-testid='first-login-modal-get-access-link'
              inherit
            >
              see how to get access on the PALM site
            </Anchor>
            .
          </Text>
        ) : null}
      </Text>

      <Title order={3} color='gray.6' my='sm'>Using Your Join Code</Title>
      <Text color='gray.7' align='left' size='sm' my='sm'>
        Once you have your join code, follow these steps to join a user group:
        <ol>
          <li>Navigate to the <b>Profile</b> page of PALM.</li>
          <li>Click on the <b>User Groups</b> tab.</li>
          <li>Enter your join code in the provided input field.</li>
          <li>Submit the code to gain access to a group and its resources.</li>
        </ol>
        Already have a join code? Enter it now:
        <Box py='sm'>
          <JoinUserGroupForm closeModalHandler={closeModalHandler}/>
        </Box>
      </Text>
    </Modal>
  );
}
