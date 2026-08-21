import { Card, createStyles, Group, Stack, Text, Title, useMantineTheme, Badge, ThemeIcon, UnstyledButton, Tooltip, Indicator } from '@mantine/core';
import { useRouter } from 'next/router';
import { KeyboardEvent, MouseEvent } from 'react';
import {
  IconTrash,
  IconShare,
  IconCopy,
  IconPencil,
  IconPlayerPlay,
} from '@tabler/icons-react';

import { generateWorkflowUrl } from '@/features/shared/utils/prompt-helpers';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import { getTimeUntilExpiration } from '@/features/shared/utils/dateUtils';
import { SHARED_WORKFLOW_INVITATION_EXPIRY_DAYS } from '@/features/workflows/types/shared-workflow';
import { EmptyWorkflowCard } from '@/features/workflows/components/EmptyWorkflowCard';

const useStyles = createStyles((theme) => ({
  card: {
    minHeight: '188px',
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    ':hover': {
      background: theme.colors.dark[5],
      cursor: 'pointer',
    },
    ':focus-visible': {
      borderColor: theme.colors.blue[6],
      borderWidth: '1px',
    },
  },
}));

type WorkflowCardProps = {
  workflows: Array<{
    id: string;
    name: string;
    description: string | null;
    primitiveCount?: number;
    executionCount: number;
    creator: { id: string; name: string; email: string | null };
    createdAt: Date | string;
  }>;
  currentUserId: string | undefined;
  sharedWorkflowsData: {
    outgoing?: Array<{
      id: string;
      workflowId: string;
      sharedWithUserGroupIds: string[];
      createdAt: Date | string;
    }>;
  } | undefined;
  onEdit: (workflowId: string, workflowName: string, workflowDescription: string) => void;
  onCopy: (workflowId: string, workflowName: string) => void;
  onShare: (workflowId: string, workflowName: string) => void;
  onDelete: (workflowId: string, workflowName: string) => void;
  onRun?: (workflowId: string, workflowName: string) => void;
};

export function WorkflowCardsContainer({
  workflows,
  currentUserId,
  sharedWorkflowsData,
  onEdit,
  onCopy,
  onShare,
  onDelete,
  onRun,
}: WorkflowCardProps) {

  const theme = useMantineTheme();
  const router = useRouter();
  const { classes } = useStyles();
  const track = useTrackClientEvent();

  const recordInteraction = (workflow: { id: string; name: string }, url: string) => {
    track.navigate(workflow.name, url);
  };

  // Card view handlers
  const handleCardOnClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>, workflow: { id: string; name: string }) => {
    const url = generateWorkflowUrl(workflow.name, workflow.id);
    recordInteraction(workflow, url);
    router.push(url);
    event.stopPropagation();
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, workflow: { id: string; name: string }) => {
    if (event.key === 'Enter') {
      const url = generateWorkflowUrl(workflow.name, workflow.id);
      recordInteraction(workflow, url);
      router.push(url);
      event.stopPropagation();
    }
  };

  return (
    <>
      <EmptyWorkflowCard />
      {workflows?.map((workflow) => {
        const isOwner = workflow.creator.id === currentUserId;
        const outgoingShare = sharedWorkflowsData?.outgoing?.find(
          (s) => s.workflowId === workflow.id
        );
        const isAlreadyShared = !!outgoingShare;

        return (
          <Card
            className={classes.card}
            aria-label={'workflow-card: ' + workflow.name}
            key={workflow.id}
            tabIndex={0}
            shadow='sm'
            p='none'
            radius='6px'
            withBorder={true}
            onClick={(event: MouseEvent<HTMLDivElement, MouseEvent>) => handleCardOnClick(event, workflow)}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => handleCardKeyDown(event, workflow)}
          >
            <Stack spacing='0' h='100%'>
              <Group spacing='xs' bg='dark.4' p='sm' align='center' style={{ minHeight: '40px' }}>
                <Badge color='orange'>{workflow.primitiveCount ?? 0} steps</Badge>
                {isAlreadyShared && outgoingShare && (() => {
                  const { timeRemainingText, isExpired } = getTimeUntilExpiration(new Date(outgoingShare.createdAt), SHARED_WORKFLOW_INVITATION_EXPIRY_DAYS);
                  const tooltipText = isExpired
                    ? 'This shared workflow invitation has expired'
                    : `This workflow share expires in ${timeRemainingText}`;

                  return (
                    <Tooltip label={tooltipText} position='top' withinPortal>
                      <Badge
                        color={isExpired ? 'red' : 'blue'}
                        size='sm'
                        variant='light'
                        style={{ cursor: 'help' }}
                      >
                        Shared
                      </Badge>
                    </Tooltip>
                  );
                })()}
              </Group>
              <Title order={4} color='gray.6' p={`${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.sm}`}>
                {workflow.name}
              </Title>
              <Text
                color='gray.6' 
                size='xssm'
                px='md'
                mb='md'
                lineClamp={2}
               >
                {workflow.description || 'No description'}
              </Text>
              <Group
                position='apart'
                align='center'
                p={`${theme.spacing.sm} ${theme.spacing.md}`}
                style={{
                  borderTop: `1px solid ${theme.colors.dark[4]}`,
                  marginTop: 'auto',
                }}
              >
                <Group spacing='sm'>
                  <Tooltip label='Run workflow' position='bottom'>
                    <UnstyledButton
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (onRun) {
                          recordInteraction(
                            workflow,
                            `${generateWorkflowUrl(workflow.name, workflow.id)}?run=true`,
                          );
                          onRun(workflow.id, workflow.name);
                        }
                      }}
                      data-testid={`${workflow.id}-run`}
                      aria-label={`Run workflow ${workflow.name}`}
                    >
                      <ThemeIcon c='gray.6'>
                        <IconPlayerPlay />
                      </ThemeIcon>
                    </UnstyledButton>
                  </Tooltip>
                  {isOwner && (
                    <Tooltip label='Edit workflow name and description' position='bottom'>
                      <UnstyledButton
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onEdit(workflow.id, workflow.name, workflow.description || '');
                        }}
                        data-testid={`${workflow.id}-edit`}
                        aria-label={`Edit workflow ${workflow.name}`}
                      >
                        <ThemeIcon>
                          <IconPencil />
                        </ThemeIcon>
                      </UnstyledButton>
                    </Tooltip>
                  )}
                  {isOwner && (
                    <Tooltip label='Manage share settings' position='bottom'>
                      <Indicator
                        inline
                        label={isAlreadyShared ? outgoingShare?.sharedWithUserGroupIds.length : undefined}
                        size={16}
                        disabled={!isAlreadyShared}
                        color='blue'
                      >
                        <UnstyledButton
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onShare(workflow.id, workflow.name);
                          }}
                          data-testid={`${workflow.id}-share`}
                          aria-label={`Share workflow ${workflow.name}`}
                        >
                          <ThemeIcon c='gray.6'>
                            <IconShare />
                          </ThemeIcon>
                        </UnstyledButton>
                      </Indicator>
                    </Tooltip>
                  )}
                  {isOwner && (
                    <Tooltip label='Copy workflow' position='bottom'>
                      <UnstyledButton
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onCopy(workflow.id, workflow.name);
                        }}
                        data-testid={`${workflow.id}-copy`}
                        aria-label={`Copy workflow ${workflow.name}`}
                      >
                        <ThemeIcon c='gray.6'>
                          <IconCopy />
                        </ThemeIcon>
                      </UnstyledButton>
                    </Tooltip>
                  )}
                  {isOwner && (
                    <Tooltip label='Delete workflow' position='bottom'>
                      <UnstyledButton
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onDelete(workflow.id, workflow.name);
                        }}
                        data-testid={`${workflow.id}-delete`}
                        aria-label={`Delete workflow ${workflow.name}`}
                      >
                        <ThemeIcon c='gray.6'>
                          <IconTrash />
                        </ThemeIcon>
                      </UnstyledButton>
                    </Tooltip>
                  )}
                </Group>
                <Text size='xs' color='gray.6'>
                  {workflow.executionCount} {workflow.executionCount === 1 ? 'execution' : 'executions'}
                </Text>
              </Group>
            </Stack>
          </Card>
        );
      })}
    </>
  );
}
