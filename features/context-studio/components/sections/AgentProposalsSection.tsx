import { Fragment, useState } from 'react';
import { Anchor, Badge, Card, Skeleton, Stack, Table, Text, Title, Tooltip } from '@mantine/core';

import { AgentProposalJob, AgentProposalJobType } from '@/features/context-studio/types/context-studio';
import StudioLoadError from '@/features/context-studio/components/sections/StudioLoadError';

const EMPTY = '—';
const COLUMN_COUNT = 7;

const AGENT_COLORS: Record<AgentProposalJobType, string> = {
  PRISM: 'violet',
  ODRAM: 'orange',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'teal',
  error: 'red',
};

type AgentProposalsSectionProps = Readonly<{
  jobs: AgentProposalJob[] | undefined;
  loading: boolean;
  failed: boolean;
}>;

export default function AgentProposalsSection({ jobs, loading, failed }: AgentProposalsSectionProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  if (loading) {
    return (
      <Card shadow='sm' padding='lg' radius='md' withBorder data-testid='agent-proposals-loading'>
        <Skeleton height={100} />
      </Card>
    );
  }

  if (failed) {
    return (
      <Card shadow='sm' padding='lg' radius='md' withBorder>
        <StudioLoadError />
      </Card>
    );
  }

  if (!jobs || jobs.length === 0) {
    return null;
  }

  const toggle = (jobId: string) => {
    setExpandedJobId((current) => (current === jobId ? null : jobId));
  };

  return (
    <Card shadow='sm' padding='lg' radius='md' withBorder data-testid='agent-proposals-section'>
      <Title order={4} mb='md'>Proposals Supported</Title>
      <Table highlightOnHover>
        <thead>
          <tr>
            <th>Proposal</th>
            <th>Client</th>
            <th>Value</th>
            <th>Agent</th>
            <th>Run by</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <Fragment key={job.jobId}>
              <tr
                data-testid={`agent-proposal-row-${job.jobId}`}
                onClick={() => toggle(job.jobId)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  {job.proposalName ?? (
                    <Tooltip label='Details not captured for this run'>
                      <Text size='sm' color='dimmed' data-testid={`agent-proposal-fallback-${job.jobId}`}>
                        {job.fallbackFilename}
                      </Text>
                    </Tooltip>
                  )}
                </td>
                <td>{job.clientName ?? EMPTY}</td>
                <td>{job.financialValue ?? EMPTY}</td>
                <td data-testid={`agent-proposal-agent-${job.jobId}`}>
                  <Stack spacing={2}>
                    <Badge color={AGENT_COLORS[job.agentType]} variant='light' w='fit-content'>
                      {job.agentType}
                    </Badge>
                    <Text size='xs' color='dimmed'>{job.agentName}</Text>
                  </Stack>
                </td>
                <td data-testid={`agent-proposal-run-by-${job.jobId}`}>
                  {job.userEmail ? (
                    <Anchor
                      href={`mailto:${job.userEmail}`}
                      size='sm'
                      onClick={(event: React.MouseEvent) => event.stopPropagation()}
                    >
                      {job.userName}
                    </Anchor>
                  ) : (
                    job.userName
                  )}
                </td>
                <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                <td>
                  <Badge color={STATUS_COLORS[job.status] ?? 'gray'} variant='light'>
                    {job.status}
                  </Badge>
                </td>
              </tr>
              {expandedJobId === job.jobId && (
                <tr>
                  <td colSpan={COLUMN_COUNT} data-testid={`agent-proposal-summary-${job.jobId}`}>
                    {job.opportunitySummary ? (
                      <Text size='sm'>{job.opportunitySummary}</Text>
                    ) : (
                      <Text size='sm' color='dimmed'>No opportunity summary was captured for this run.</Text>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
