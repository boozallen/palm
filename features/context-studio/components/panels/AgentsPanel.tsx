import { Grid, Stack } from '@mantine/core';

import {
  AgentProposalJob,
  AgentServiceStats,
  AiAgentStats,
  PromptStats,
  WorkflowStats,
} from '@/features/context-studio/types/context-studio';
import AgentProposalsSection from '@/features/context-studio/components/sections/AgentProposalsSection';
import AgentServiceSection from '@/features/context-studio/components/sections/AgentServiceSection';
import AgentProviderSection from '@/features/context-studio/components/sections/AgentProviderSection';
import AiAgentsSection from '@/features/context-studio/components/sections/AiAgentsSection';
import AiProvidersSection from '@/features/context-studio/components/sections/AiProvidersSection';
import MarginAnalysesCard from '@/features/context-studio/components/sections/MarginAnalysesCard';
import OdramAssessmentSection from '@/features/context-studio/components/sections/OdramAssessmentSection';
import OdramJobsCard from '@/features/context-studio/components/sections/OdramJobsCard';
import PrismComplianceSection from '@/features/context-studio/components/sections/PrismComplianceSection';
import PrismJobsCard from '@/features/context-studio/components/sections/PrismJobsCard';
import WorkflowSharingSection from '@/features/context-studio/components/sections/WorkflowSharingSection';

// The Agents tab: the agents and services doing the work, then the providers
// backing them. Ordered widest-to-narrowest — the agent roster first, then the
// per-agent job counts and the proposals they ran against, then the breakdowns.

type AgentsPanelProps = Readonly<{
  promptStats: PromptStats | undefined;
  promptStatsLoading: boolean;
  workflowStats: WorkflowStats | undefined;
  workflowStatsLoading: boolean;
  aiAgentStats: AiAgentStats | undefined;
  aiAgentStatsLoading: boolean;
  agentServiceStats: AgentServiceStats | undefined;
  agentServiceStatsLoading: boolean;
  agentProposalJobs: AgentProposalJob[] | undefined;
  agentProposalJobsLoading: boolean;
  agentProposalJobsFailed: boolean;
}>;

export default function AgentsPanel({
  promptStats,
  promptStatsLoading,
  workflowStats,
  workflowStatsLoading,
  aiAgentStats,
  aiAgentStatsLoading,
  agentServiceStats,
  agentServiceStatsLoading,
  agentProposalJobs,
  agentProposalJobsLoading,
  agentProposalJobsFailed,
}: AgentsPanelProps) {
  return (
    <Stack spacing='lg'>
      <Grid>
        <AiAgentsSection
          aiAgentStats={aiAgentStats}
          aiAgentStatsLoading={aiAgentStatsLoading}
        />
      </Grid>

      <Grid>
        <PrismJobsCard
          aiAgentStats={aiAgentStats}
          aiAgentStatsLoading={aiAgentStatsLoading}
        />
        <OdramJobsCard
          aiAgentStats={aiAgentStats}
          aiAgentStatsLoading={aiAgentStatsLoading}
        />
        <MarginAnalysesCard
          aiAgentStats={aiAgentStats}
          aiAgentStatsLoading={aiAgentStatsLoading}
        />
      </Grid>

      <AgentProposalsSection
        jobs={agentProposalJobs}
        loading={agentProposalJobsLoading}
        failed={agentProposalJobsFailed}
      />

      <PrismComplianceSection
        aiAgentStats={aiAgentStats}
        aiAgentStatsLoading={aiAgentStatsLoading}
      />

      <OdramAssessmentSection
        aiAgentStats={aiAgentStats}
        aiAgentStatsLoading={aiAgentStatsLoading}
      />

      <AgentServiceSection
        agentServiceStats={agentServiceStats}
        agentServiceStatsLoading={agentServiceStatsLoading}
      />

      <AgentProviderSection
        agentServiceStats={agentServiceStats}
        agentServiceStatsLoading={agentServiceStatsLoading}
      />

      <WorkflowSharingSection
        workflowStats={workflowStats}
        workflowStatsLoading={workflowStatsLoading}
      />

      <AiProvidersSection
        promptStats={promptStats}
        promptStatsLoading={promptStatsLoading}
      />
    </Stack>
  );
}
