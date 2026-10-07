import { useRouter } from 'next/router';
import { Box, Text, Center, Stack, ActionIcon, Tooltip } from '@mantine/core';
import { IconAlertCircle, IconX } from '@tabler/icons-react';
import { useGetWorkflowStatus } from '@/features/workflows/api/get-workflow-status';
import { trpc } from '@/libs';
import CenteredLoader from '@/features/shared/components/CenteredLoader';
import { useState, useEffect } from 'react';

export default function ShareHtmlPage() {
  const router = useRouter();
  const { slug, executionId, primitiveId } = router.query;
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoadingArtifact, setIsLoadingArtifact] = useState(false);

  const { data: statusData, isLoading } = useGetWorkflowStatus(executionId as string);
  const utils = trpc.useUtils();

  // Calculate derived values for the effect
  const liveTrace = statusData?.progress?.trace;
  const finalTrace = statusData?.execution?.trace;
  const activeTrace = (liveTrace?.length ? liveTrace : finalTrace) ?? [];
  const primitive = activeTrace.find((trace: any) => trace.primitiveId === primitiveId);
  const artifactId = primitive?.output?.artifactId;
  const legacyContent = primitive?.output?.report;

  // Fetch artifact content if not already loaded - must be called before any returns
  useEffect(() => {
    async function fetchArtifact() {
      if (artifactId && !htmlContent && !isLoadingArtifact) {
        setIsLoadingArtifact(true);
        try {
          const artifact = await utils.client.workflows.getWorkflowArtifact.query({ artifactId });
          setHtmlContent(artifact.content);
        } catch (error) {
          console.error('Failed to fetch artifact:', error);
        } finally {
          setIsLoadingArtifact(false);
        }
      } else if (legacyContent && !htmlContent) {
        // Use legacy inline content
        setHtmlContent(legacyContent);
      }
    }
    fetchArtifact();
  }, [artifactId, legacyContent, htmlContent, isLoadingArtifact, utils.client.workflows.getWorkflowArtifact]);

  if (isLoading) {
    return <CenteredLoader />;
  }

  if (!statusData?.execution) {
    return (
      <Center h='100vh'>
        <Stack align='center' spacing='md'>
          <IconAlertCircle size={48} color='red' />
          <Text size='lg' color='red'>Execution not found</Text>
        </Stack>
      </Center>
    );
  }

  if (!primitive) {
    return (
      <Center h='100vh'>
        <Stack align='center' spacing='md'>
          <IconAlertCircle size={48} color='red' />
          <Text size='lg' color='red'>Primitive not found</Text>
        </Stack>
      </Center>
    );
  }

  // Backward compatibility: support both new and old output structures
  const fileExtension = primitive.output?.fileExtension || primitive.output?.format || primitive.config?.format;

  if (isLoadingArtifact) {
    return <CenteredLoader />;
  }

  if (!htmlContent || fileExtension !== '.html') {
    return (
      <Center h='100vh'>
        <Stack align='center' spacing='md'>
          <IconAlertCircle size={48} color='red' />
          <Text size='lg' color='red'>No HTML content available</Text>
        </Stack>
      </Center>
    );
  }

  const handleClose = () => {
    const workflowId = statusData?.execution?.workflowId;
    if (workflowId) {
      router.push(`/workflows/${slug}/${workflowId}?showExecution=true&executionId=${executionId}`);
    } else {
      router.back();
    }
  };

  return (
    <Box
      style={{
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Tooltip label='Return to workflow'>
        <ActionIcon
          variant='filled'
          color='red'
          // size='lg'
          radius='xl'
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            zIndex: 1000,
            cursor: 'pointer !important',
          }}
        >
          <IconX size={20} />
        </ActionIcon>
      </Tooltip>
      <iframe
        srcDoc={htmlContent}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title='Shared HTML Content'
        sandbox='allow-scripts allow-same-origin'
      />
    </Box>
  );
}
