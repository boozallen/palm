import { Box, Modal, Text, Title } from '@mantine/core';
import React from 'react';
import JoinUserGroupForm from '@/features/profile/components/forms/JoinUserGroupForm';

type FirstLoginModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
}>;

export default function FirstLoginModal({ modalOpened, closeModalHandler }: FirstLoginModalProps) {

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
    >
      <Title order={3} color='gray.6' mb='sm'>Getting Started</Title>
      <Text color='gray.7' align='left' size='sm'>
        To access the appropriate workspace and LLM resources, you must belong to at least <b>1</b> user group.
        You will need a <b>join code</b> to become a member of a specific group.
      </Text>

      <Title order={3} color='gray.6' my='sm'>How to Obtain a Join Code</Title>
      <Text color='gray.7' align='left' size='sm' my='sm'>
        You should have already received a join code from your group lead or manager. If not, please reach out to them.
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
