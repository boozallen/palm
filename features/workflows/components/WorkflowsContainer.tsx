import React from 'react';
import { SimpleGrid, Text, Table, Badge, Group, ActionIcon, Tooltip, Anchor, Indicator } from '@mantine/core';
import Link from 'next/link';
import {
  IconTrash,
  IconShare,
  IconCopy,
  IconPencil,
  IconPlayerPlay,
} from '@tabler/icons-react';

import { WorkflowCardsContainer } from '@/features/workflows/components/WorkflowCardsContainer';
import { generateWorkflowUrl } from '@/features/shared/utils/prompt-helpers';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import { getTimeUntilExpiration } from '@/features/shared/utils/dateUtils';
import { SHARED_WORKFLOW_INVITATION_EXPIRY_DAYS } from '@/features/workflows/types/shared-workflow';

interface WorkflowsContainerProps {
  workflows: Array<{
    id: string;
    name: string;
    description: string | null;
    primitiveCount?: number;
    executionCount: number;
    creator: { id: string; name: string; email: string | null };
    createdAt: Date | string;
  }>;
  isTableView: boolean;
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
}

const WorkflowsContainer: React.FC<WorkflowsContainerProps> = ({
  workflows,
  isTableView,
  currentUserId,
  sharedWorkflowsData,
  onEdit,
  onCopy,
  onShare,
  onDelete,
  onRun,
}) => {
  const track = useTrackClientEvent();

  let content;
  if (isTableView) {
    if (workflows?.length) {
      content = (
        <Table highlightOnHover>
          <thead>
            <tr>
              <th>Name</th>
              <th>Nodes</th>
              <th>Executions</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((workflow) => {
              const isOwner = workflow.creator.id === currentUserId;
              const outgoingShare = sharedWorkflowsData?.outgoing?.find(
                (s) => s.workflowId === workflow.id
              );
              const isAlreadyShared = !!outgoingShare;

              return (
                <tr key={workflow.id}>
                  <td>
                    <div style={{ maxWidth: '500px' }}>
                      <Group spacing='xs'>
                        <Anchor
                          component={Link}
                          href={generateWorkflowUrl(workflow.name, workflow.id)}
                          onClick={() => track.navigate(workflow.name, generateWorkflowUrl(workflow.name, workflow.id))}
                          fw={500}
                        >
                          {workflow.name}
                        </Anchor>
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
                      {workflow.description && (
                        <Text size='xs' color='gray.6' lineClamp={2}>
                          {workflow.description}
                        </Text>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge color='orange'>{workflow.primitiveCount ?? 0} steps</Badge>
                  </td>
                  <td>{workflow.executionCount}</td>
                  <td>
                    <Text size='sm'>
                      {new Date(workflow.createdAt).toLocaleDateString()}
                    </Text>
                  </td>
                  <td>
                    <Group spacing='xs'>
                      <Tooltip label='Run workflow'>
                        <ActionIcon
                          c='gray.6'
                          onClick={() => {
                            if (onRun) {
                              onRun(workflow.id, workflow.name);
                            }
                          }}
                          data-testid={`${workflow.id}-run`}
                          aria-label={`Run workflow ${workflow.name}`}
                        >
                          <IconPlayerPlay />
                        </ActionIcon>
                      </Tooltip>
                      {isOwner && (
                        <Tooltip label='Edit workflow name and description'>
                          <ActionIcon
                            onClick={() => onEdit(workflow.id, workflow.name, workflow.description || '')}
                            data-testid={`${workflow.id}-edit`}
                            aria-label={`Edit workflow ${workflow.name}`}
                          >
                            <IconPencil />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {isOwner && (
                        <Tooltip label='Manage share settings'>
                          <Indicator
                            inline
                            label={isAlreadyShared ? outgoingShare?.sharedWithUserGroupIds.length : undefined}
                            size={16}
                            disabled={!isAlreadyShared}
                            color='blue'
                          >
                            <ActionIcon
                              c='gray.6'
                              onClick={() => onShare(workflow.id, workflow.name)}
                              data-testid={`${workflow.id}-share`}
                              aria-label={`Share workflow ${workflow.name}`}
                            >
                              <IconShare />
                            </ActionIcon>
                          </Indicator>
                        </Tooltip>
                      )}
                      {isOwner && (
                        <Tooltip label='Copy workflow'>
                          <ActionIcon
                            c='gray.6'
                            onClick={() => onCopy(workflow.id, workflow.name)}
                            data-testid={`${workflow.id}-copy`}
                            aria-label={`Copy workflow ${workflow.name}`}
                          >
                            <IconCopy />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {isOwner && (
                        <ActionIcon
                          c='gray.6'
                          onClick={() => onDelete(workflow.id, workflow.name)}
                          data-testid={`${workflow.id}-delete`}
                          aria-label={`Delete workflow ${workflow.name}`}
                        >
                          <IconTrash />
                        </ActionIcon>
                      )}
                    </Group>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      );
    } else {
      content = (
        <Text c='gray.6' fz='xl'>
          No workflows found.
        </Text>
      );
    }
  } else {
    content = (
      <WorkflowCardsContainer
        workflows={workflows}
        currentUserId={currentUserId}
        sharedWorkflowsData={sharedWorkflowsData}
        onEdit={onEdit}
        onCopy={onCopy}
        onShare={onShare}
        onDelete={onDelete}
        onRun={onRun}
      />
    );
  }

  return (
    <SimpleGrid
      cols={isTableView ? 1 : 4}
      breakpoints={
        isTableView
          ? []
          : [
            { maxWidth: 'xl', cols: 3, spacing: 'lg' },
            { maxWidth: 'lg', cols: 2, spacing: 'lg' },
            { maxWidth: 'md', cols: 2, spacing: 'lg' },
            { maxWidth: 'sm', cols: 1, spacing: 'lg' },
          ]
      }
      spacing='lg'
      verticalSpacing='lg'
    >
      {content}
    </SimpleGrid>
  );
};

export default WorkflowsContainer;
