import { SimpleGrid, Title, Text, Stack } from '@mantine/core';
import { useRouter } from 'next/router';
import ContextStudioDashboard from '@/features/context-studio/components/ContextStudioDashboard';
import { useGetUserContextStudioAccess } from '@/features/shared/api/get-user-context-studio-access';
import CenteredLoader from '@/features/shared/components/CenteredLoader';

export default function ContextStudioPage() {
  const router = useRouter();

  const {
    data: userContextStudioAccess,
    isPending: userContextStudioAccessPending,
  } = useGetUserContextStudioAccess();

  if (userContextStudioAccessPending) {
    return <CenteredLoader />;
  }

  if (!userContextStudioAccess?.hasAccess) {
    router.push('/');
    return null;
  }

  return (
    <>
      <SimpleGrid cols={2} p='md' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            Context Studio
          </Title>
          <Text fz='md' c='gray.6'>
            Observability and insights for LLM interactions
          </Text>
        </Stack>
      </SimpleGrid>
      <ContextStudioDashboard />
    </>
  );
}
