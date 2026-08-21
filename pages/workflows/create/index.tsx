import { SimpleGrid, Stack, Text, Title, Box, ActionIcon, Flex, Tooltip } from '@mantine/core';
import { useRouter } from 'next/router';
import { useState, useContext, useEffect } from 'react';
import { IconSparkles, IconDeviceFloppy } from '@tabler/icons-react';

import WorkflowBuilder from '@/features/workflows/components/WorkflowBuilder';
import { useGetUserWorkflowsAccess } from '@/features/shared/api/get-user-workflows-access';
import CenteredLoader from '@/features/shared/components/CenteredLoader';
import ConversationalWorkflowPlanner from '@/features/workflows/components/ConversationalWorkflowPlanner';
import { WorkflowBuilderProvider, useWorkflowBuilder } from '@/features/workflows/providers/WorkflowBuilderProvider';
import CreateWorkflowModal from '@/features/workflows/components/modals/CreateWorkflowModal';
import Breadcrumbs from '@/components/elements/Breadcrumbs';
import { SafeExitContext } from '@/features/shared/utils';
import { generateWorkflowUrl } from '@/features/shared/utils/prompt-helpers';

function DefaultWorkflowPageContent() {
  const router = useRouter();
  const [showPlanner, setShowPlanner] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { nodes } = useWorkflowBuilder();
  const { setSafeExitFormToDirty } = useContext(SafeExitContext);

  useEffect(() => {
    setSafeExitFormToDirty(nodes.length > 0);

    return () => {
      setSafeExitFormToDirty(false);
    };
  }, [nodes.length, setSafeExitFormToDirty]);

  const handleSaveWorkflow = () => {
    setShowCreateModal(true);
  };

  const handleWorkflowCreated = (workflowId: string, workflowName: string) => {
    setShowCreateModal(false);
    // Navigate to workflow page with run flag
    router.replace(
      `${generateWorkflowUrl(workflowName, workflowId)}?run=true`,
      undefined,
      { shallow: false },
    );
  };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <SimpleGrid cols={1} p='md' pb='0' bg='dark.7'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            Create Workflow
          </Title>
          <Text fz='md' c='gray.6'>
            Build complex workflows with custom logic and tools
          </Text>
        </Stack>
        <Flex justify='space-between' align='center'>
          <Breadcrumbs links={[
            { title: 'Workflows', href: '/workflows' },
            { title: 'Create', href: null },
          ]} />
          <Flex gap='sm' align='center'>
            <Tooltip label='Save workflow'>
              <ActionIcon
                variant='light'
                disabled={nodes.length === 0}
                onClick={handleSaveWorkflow}
                size='md'
                color={nodes.length > 0 ? 'gray' : 'blue'}
                sx={(theme) => ({
                  backgroundColor: nodes.length > 0 ? theme.colors.blue[6] : theme.colors.dark[4],
                  color: nodes.length > 0 ? theme.white : theme.colors.gray[6],
                  '&:hover': {
                    backgroundColor: nodes.length > 0 ? theme.colors.blue[5] : theme.colors.dark[4],
                  },
                  '&:disabled': {
                    backgroundColor: `${theme.colors.dark[4]} !important`,
                    color: `${theme.colors.gray[6]} !important`,
                  },
                })}
              >
                <IconDeviceFloppy size={24} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={showPlanner ? 'Hide planning assistant' : 'Show planning assistant'} position='bottom'>
              <ActionIcon
                size='md'
                variant='light'
                onClick={() => setShowPlanner((prev) => !prev)}
                sx={(theme) => ({
                  backgroundColor: showPlanner ? theme.colors.blue[6] : theme.colors.dark[4],
                  color: showPlanner ? theme.white : theme.colors.gray[6],
                  '&:hover': {
                    backgroundColor: showPlanner ? theme.colors.blue[5] : theme.colors.dark[5],
                  },
                })}
              >
                <IconSparkles size={20} />
              </ActionIcon>
            </Tooltip>
          </Flex>
        </Flex>
      </SimpleGrid>

      <Box style={{
        display: 'flex',
        flexGrow: 1,
        backgroundColor: 'var(--mantine-color-dark-8)',
        overflow: 'hidden',
      }}>
        {/* Main Canvas Area */}
        <Box style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
        }} p='md'>
          <WorkflowBuilder
            generatorPanel={showPlanner ? <ConversationalWorkflowPlanner onSaveWorkflow={handleSaveWorkflow} /> : undefined}
          />
        </Box>
      </Box>

      <CreateWorkflowModal
        opened={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleWorkflowCreated}
      />
    </Box>
  );
}

export default function DefaultWorkflowPage() {
  const router = useRouter();
  
  const {
    data: userWorkflowsAccess,
    isPending: userWorkflowsAccessPending,
  } = useGetUserWorkflowsAccess();

  if (userWorkflowsAccessPending) {
    return <CenteredLoader />;
  }

  if (!userWorkflowsAccess?.hasAccess) {
    router.push('/');
    return null;
  }

  return (
    <WorkflowBuilderProvider>
      <DefaultWorkflowPageContent />
    </WorkflowBuilderProvider>
  );
}
