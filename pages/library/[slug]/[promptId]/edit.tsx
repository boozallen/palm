import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Box, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import Loading from '@/features/shared/components/Loading';
import EditPromptForm from '@/features/library/components/forms/EditPromptForm';
import { useGetPrompt } from '@/features/library/api/get-prompt';
import { UserRole } from '@/features/shared/types/user';

export default function EditPrompt() {
  const router = useRouter();
  const { promptId } = router.query;
  const user = useSession()?.data?.user;

  const {
    data: prompt,
    isPending: promptIsPending,
    error: promptError,
  } = useGetPrompt({ promptId: promptId as string });

  const userCanEdit = useMemo(() => {
    if (!user) {
      return false;
    }

    return user.role === UserRole.Admin || user.id === prompt?.prompt.creatorId;
  }, [user, prompt?.prompt]);

  useEffect(() => {
    if (
      (!promptIsPending && !userCanEdit)
    ) {
      router.push('/library');
    }
  }, [
    promptIsPending,
    router,
    userCanEdit,
  ]);

  if (promptIsPending) {
    return <Loading />;
  }

  if (promptError || !prompt.prompt) {
    return <Text>Error loading prompt. Please refresh the page or try again later</Text>;
  }

  return (
    <>
      <SimpleGrid cols={2} p='xl'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.0'>
            Edit Your Prompt
          </Title>
          <Text fz='md' c='gray.6'>
            Fill out the form below to modify and refine a prompt you have created.
          </Text>
        </Stack>
      </SimpleGrid>

      <Box bg='dark.6' p='xl'>
        <EditPromptForm prompt={prompt.prompt} />
      </Box>
    </>
  );
}
