import { Modal, Button, Flex, Text, Avatar, Title, Stack, Group } from '@mantine/core';
import { signOut } from 'next-auth/react';
import { useContext, useState } from 'react';
import { UserSessionContext } from '@/components/layouts/AuthWrap';
import { useLogout } from '@/providers/LogoutProvider';

export function UserBanner() {
  const session = useContext(UserSessionContext);
  const { name, email, image, lastLoginAt } = session.user;

  const { setIsUserLoggingOut } = useLogout();

  const [opened, setOpened] = useState(false);

  const handleSignOut = () => {
    signOut({ redirect: false })
      .then(() => {
        setIsUserLoggingOut(true);
      })
      .catch(() => {
        setOpened(true);
      });
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        centered
        withCloseButton={false}
        size='xs'
        radius='sm'
      >
        <Flex direction='column' justify='center' align='center'>
          <Text mb='xs' mt='lg'>
            Logout failed. Please try again.
          </Text>
          <Button variant='filled' my='lg' onClick={() => setOpened(false)}>
            Close
          </Button>
        </Flex>
      </Modal>
      <Flex w='100%' gap='md' align='center' direction='row'>
        <Stack spacing='sm'>
          <Group spacing='md'>
            <Avatar
              src={image}
              radius={'xl'}
              alt='User Picture'
            />
            <Title fz='xxl' c='gray.0' order={2}>
              {name}
            </Title>
          </Group>
          <Stack spacing='xxs'>
            <Text fz='sm' c='gray.7'>
              {email}
            </Text>
            <Text fz='sm' c='gray.7'>
              Last Login: {lastLoginAt ? new Date(lastLoginAt).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
            </Text>
          </Stack>
        </Stack>
        <Button color='gray' variant='outline' ml='auto' onClick={handleSignOut}>
          Logout
        </Button>
      </Flex>
    </>
  );
}
