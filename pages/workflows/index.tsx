import {
  Title,
  Button,
  Table,
  Badge,
  Text,
  Stack,
  Alert,
  SimpleGrid,
  Box,
  ActionIcon,
  Group,
  Tooltip,
  Flex,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconX,
  IconPlus,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';

import { useGetWorkflows } from '@/features/workflows/api/get-workflows';
import { useGetUserWorkflowsAccess } from '@/features/shared/api/get-user-workflows-access';
import CenteredLoader from '@/features/shared/components/CenteredLoader';
import DeleteWorkflowModal from '@/features/workflows/components/modals/DeleteWorkflowModal';
import EditWorkflowModal from '@/features/workflows/components/modals/EditWorkflowModal';
import ShareAssetModal from '@/features/shared/components/modals/ShareAssetModal';
import CopyWorkflowModal from '@/features/workflows/components/modals/CopyWorkflowModal';
import WorkflowViewToggle from '@/features/workflows/components/WorkflowViewToggle';
import WorkflowsContainer from '@/features/workflows/components/WorkflowsContainer';
import SearchBar from '@/features/shared/components/SearchBar';
import { useShareWorkflow } from '@/features/workflows/api/share-workflow';
import { useCopyWorkflow } from '@/features/workflows/api/copy-workflow';
import { useUpdateWorkflowShares } from '@/features/workflows/api/update-workflow-shares';
import useGetSharedWorkflows from '@/features/workflows/api/get-shared-workflows';
import useAcceptSharedWorkflow from '@/features/workflows/api/accept-shared-workflow';
import { useRejectSharedWorkflow } from '@/features/workflows/api/reject-shared-workflow';
import { getTimeUntilExpiration } from '@/features/shared/utils/dateUtils';
import { generateWorkflowUrl } from '@/features/shared/utils/prompt-helpers';
import { SHARED_WORKFLOW_INVITATION_EXPIRY_DAYS } from '@/features/workflows/types/shared-workflow';
import { UiPreference } from '@/types/ui-preferences';

export default function WorkflowsPage() {
  const router = useRouter();
  const session = useSession();
  const currentUserId = session.data?.user.id;

  const { data: workflowsData, isLoading, refetch } = useGetWorkflows();

  const {
    data: userWorkflowsAccess,
    isPending: userWorkflowsAccessPending,
  } = useGetUserWorkflowsAccess();

  const { data: sharedWorkflowsData } = useGetSharedWorkflows();

  // Manage 'Table' and 'Card' views with localStorage
  const [isTableView, setIsTableView] = useState(false);

  useEffect(() => {
    const savedView = localStorage.getItem(UiPreference.WORKFLOWS_VIEW);
    if (savedView === 'table') {
      setIsTableView(true);
    }
  }, []);

  const toggleWorkflowsView = (flag: boolean) => {
    setIsTableView(flag);
    localStorage.setItem(UiPreference.WORKFLOWS_VIEW, flag ? 'table' : 'card');
  };

  // Workflow search
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 500);

  const [
    deleteWorkflowModalOpened,
    { open: openDeleteWorkflowModal, close: closeDeleteWorkflowModal },
  ] = useDisclosure(false);

  const [
    shareWorkflowModalOpened,
    { open: openShareWorkflowModal, close: closeShareWorkflowModal },
  ] = useDisclosure(false);

  const [
    copyWorkflowModalOpened,
    { open: openCopyWorkflowModal, close: closeCopyWorkflowModal },
  ] = useDisclosure(false);

  const [
    editWorkflowModalOpened,
    { open: openEditWorkflowModal, close: closeEditWorkflowModal },
  ] = useDisclosure(false);

  const [selectedWorkflow, setSelectedWorkflow] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [editWorkflowData, setEditWorkflowData] = useState<{
    id: string;
    name: string;
    description: string;
  } | null>(null);

  const [shareWorkflowData, setShareWorkflowData] = useState<{
    id: string;
    name: string;
    isReshare: boolean;
    currentSharedGroupIds?: string[];
  } | null>(null);

  const [copyWorkflowData, setCopyWorkflowData] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const copyWorkflowMutation = useCopyWorkflow();
  const shareWorkflowMutation = useShareWorkflow();
  const updateWorkflowSharesMutation = useUpdateWorkflowShares();
  const acceptSharedWorkflowMutation = useAcceptSharedWorkflow();
  const rejectSharedWorkflowMutation = useRejectSharedWorkflow();

  const handleDeleteWorkflow = (workflowId: string, workflowName: string) => {
    setSelectedWorkflow({ id: workflowId, name: workflowName });
    openDeleteWorkflowModal();
  };

  const handleDeleteSuccess = () => {
    refetch();
    setSelectedWorkflow(null);
  };

  const handleCopyClick = (workflowId: string, workflowName: string) => {
    setCopyWorkflowData({ id: workflowId, name: workflowName });
    openCopyWorkflowModal();
  };

  const handleCopyConfirm = () => {
    if (!copyWorkflowData) {
      return;
    }

    copyWorkflowMutation.mutate(
      { workflowId: copyWorkflowData.id },
      {
        onSuccess: (data) => {
          notifications.show({
            title: 'Workflow copied',
            message: `"${data.workflowName}" has been copied to your workflows`,
            icon: <IconCheck />,
            autoClose: true,
            variant: 'successful_operation',
          });
          refetch();
        },
        onError: (error) => {
          notifications.show({
            title: 'Failed to copy workflow',
            message: error.message,
            icon: <IconX />,
            autoClose: true,
            variant: 'failed_operation',
          });
        },
      },
    );
  };

  const handleEditWorkflow = (workflowId: string, workflowName: string, workflowDescription: string) => {
    setEditWorkflowData({ id: workflowId, name: workflowName, description: workflowDescription });
    openEditWorkflowModal();
  };

  const handleShareClick = (workflowId: string, workflowName: string) => {
    const existingShare = sharedWorkflowsData?.outgoing?.find(
      (s) => s.workflowId === workflowId
    );
    setShareWorkflowData({
      id: workflowId,
      name: workflowName,
      isReshare: !!existingShare,
      currentSharedGroupIds: existingShare?.sharedWithUserGroupIds || [],
    });
    openShareWorkflowModal();
  };

  const handleShareConfirm = (selectedGroupIds: string[]) => {
    if (!shareWorkflowData) {
      return;
    }

    const mutation = shareWorkflowData.isReshare
      ? updateWorkflowSharesMutation
      : shareWorkflowMutation;

    mutation.mutate(
      { workflowId: shareWorkflowData.id, userGroupIds: selectedGroupIds },
      {
        onSuccess: () => {
          notifications.show({
            title: shareWorkflowData.isReshare ? 'Workflow shares updated' : 'Workflow shared',
            message: `"${shareWorkflowData.name}" has been ${shareWorkflowData.isReshare ? 'updated' : 'shared'} with selected user group(s)`,
            icon: <IconCheck />,
            autoClose: true,
            variant: 'successful_operation',
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Failed to share workflow',
            message: error.message,
            icon: <IconX />,
            autoClose: true,
            variant: 'failed_operation',
          });
        },
      },
    );
  };

  const handleAcceptSharedWorkflow = (sharedWorkflowId: string) => {
    acceptSharedWorkflowMutation.mutate(
      { sharedWorkflowId },
      {
        onSuccess: (data) => {
          notifications.show({
            title: 'Workflow accepted',
            message: `"${data.workflowName}" has been added to your workflows`,
            icon: <IconCheck />,
            autoClose: true,
            variant: 'successful_operation',
          });
          refetch();
        },
        onError: (error) => {
          notifications.show({
            title: 'Failed to accept workflow',
            message: error.message,
            icon: <IconX />,
            autoClose: true,
            variant: 'failed_operation',
          });
        },
      },
    );
  };

  const handleRejectSharedWorkflow = (sharedWorkflowId: string) => {
    rejectSharedWorkflowMutation.mutate(
      { sharedWorkflowId },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Workflow rejected',
            message: 'The shared workflow has been rejected',
            autoClose: true,
            variant: 'successful_operation',
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Failed to reject workflow',
            message: error.message,
            icon: <IconX />,
            autoClose: true,
            variant: 'failed_operation',
          });
        },
      },
    );
  };

  const handleRunWorkflow = (workflowId: string, workflowName: string) => {
    router.push(`${generateWorkflowUrl(workflowName, workflowId)}?run=true`);
  };

  if (userWorkflowsAccessPending) {
    return <CenteredLoader />;
  }

  if (!userWorkflowsAccess?.hasAccess) {
    router.push('/');
    return null;
  }

  if (isLoading) {
    return <CenteredLoader />;
  }

  const incomingShares = sharedWorkflowsData?.incoming ?? [];

  // Filter workflows based on search query
  const allWorkflows = workflowsData?.workflows ?? [];
  const filteredWorkflows = debouncedSearchQuery
    ? allWorkflows.filter((workflow) =>
        workflow.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        workflow.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      )
    : allWorkflows;

  const hasWorkflows = allWorkflows.length > 0;
  const hasIncoming = incomingShares.length > 0;

  return (
    <>
      <DeleteWorkflowModal
        modalOpened={deleteWorkflowModalOpened}
        closeModalHandler={closeDeleteWorkflowModal}
        workflowId={selectedWorkflow?.id || ''}
        workflowName={selectedWorkflow?.name || ''}
        onDeleteSuccess={handleDeleteSuccess}
      />

      <ShareAssetModal
        modalOpened={shareWorkflowModalOpened}
        closeModalHandler={closeShareWorkflowModal}
        assetName={shareWorkflowData?.name || ''}
        assetType='workflow'
        onConfirm={handleShareConfirm}
        isReshare={shareWorkflowData?.isReshare}
        currentSharedGroupIds={shareWorkflowData?.currentSharedGroupIds}
      />

      <CopyWorkflowModal
        modalOpened={copyWorkflowModalOpened}
        closeModalHandler={closeCopyWorkflowModal}
        workflowName={copyWorkflowData?.name || ''}
        onConfirm={handleCopyConfirm}
      />

      {editWorkflowData && (
        <EditWorkflowModal
          modalOpened={editWorkflowModalOpened}
          closeModalHandler={closeEditWorkflowModal}
          workflow={editWorkflowData}
        />
      )}

      <SimpleGrid cols={1} p='md' bg='dark.6'>
        <Flex justify='space-between' align='flex-start'>
          <Stack spacing='xxs'>
            <Title fz='xxl' order={1} align='left' color='gray.1'>
              Workflows
            </Title>
            <Text fz='md' c='gray.6'>
              Build complex workflows with custom logic and tools
            </Text>
          </Stack>
          <Button
            leftIcon={<IconPlus size={16} />}
            onClick={() => router.push('/workflows/create')}
          >
            Create Workflow
          </Button>
        </Flex>
      </SimpleGrid>

      <SimpleGrid cols={1} p='md' pb='0'>
        <Stack spacing='md'>

        {hasIncoming && (
          <Box bg='dark.6' p='md'>
            <Title weight='bold' color='gray.6' order={2} mb='md'>
              Shared With You
            </Title>
            <Table highlightOnHover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Shared By</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incomingShares.map((share) => {
                  const { timeRemainingText } = getTimeUntilExpiration(new Date(share.createdAt), SHARED_WORKFLOW_INVITATION_EXPIRY_DAYS);
                  return (
                    <tr key={share.id}>
                      <td>
                        <Group spacing='xs'>
                          <Text fw={500}>{share.sourceWorkflowName}</Text>
                          <Badge color='yellow' size='sm'>Pending</Badge>
                        </Group>
                      </td>
                      <td>
                        <Text size='sm'>{share.sharedByUsername}</Text>
                      </td>
                      <td>
                        <Text size='sm'>{timeRemainingText}</Text>
                      </td>
                      <td>
                        <Group spacing='xs'>
                          <Tooltip label='Accept workflow'>
                            <ActionIcon
                              c='green.6'
                              onClick={() => handleAcceptSharedWorkflow(share.id)}
                              data-testid={`${share.id}-accept`}
                              aria-label={`Accept workflow ${share.sourceWorkflowName}`}
                            >
                              <IconCheck />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label='Reject workflow'>
                            <ActionIcon
                              c='red.6'
                              onClick={() => handleRejectSharedWorkflow(share.id)}
                              data-testid={`${share.id}-reject`}
                              aria-label={`Reject workflow ${share.sourceWorkflowName}`}
                            >
                              <IconX />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Box>
        )}

        <Box>
          {hasWorkflows && (
            <SimpleGrid cols={2} mb='md'>
              <Group position='left'>
                <SearchBar
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchFocused={searchFocused}
                  setSearchFocused={setSearchFocused}
                  placeholder='Search workflows'
                />
              </Group>
              <Group position='right'>
                <Text align='right' c='gray.6' fz='md'>
                  {debouncedSearchQuery.length === 0
                    ? 'Results: '
                    : `Results for "${debouncedSearchQuery}" : `}
                  {filteredWorkflows.length} workflow{filteredWorkflows.length === 1 ? '' : 's'}
                </Text>
                <WorkflowViewToggle isTableView={isTableView} toggleWorkflowsView={toggleWorkflowsView} />
              </Group>
            </SimpleGrid>
          )}
          {hasWorkflows || !isTableView ? (
            <WorkflowsContainer
              workflows={filteredWorkflows}
              isTableView={isTableView}
              currentUserId={currentUserId}
              sharedWorkflowsData={sharedWorkflowsData}
              onEdit={handleEditWorkflow}
              onCopy={handleCopyClick}
              onShare={handleShareClick}
              onDelete={handleDeleteWorkflow}
              onRun={handleRunWorkflow}
            />
          ) : (
            !hasIncoming && (
              <Alert icon={<IconAlertCircle size={16} />} title='No workflows yet'>
                Create your first workflow to get started
              </Alert>
            )
          )}
        </Box>
        </Stack>
      </SimpleGrid>
    </>
  );
}
