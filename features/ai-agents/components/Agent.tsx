import React from 'react';
import { Box, Text } from '@mantine/core';

import WebPolicyComplianceAgent from './certa/Agent';
import ResearchAgent from './radar/Agent';
import { AiAgentType } from '@/features/shared/types';

type AgentProps = Readonly<{
  label: string;
  type: AiAgentType;
  id: string;
}>;

// Component used to render the correct agent based on the title
export default function Agent({ label, type, id }: AgentProps) {
  // Map agent type to their respective components
  const AGENT_COMPONENTS: Record<AiAgentType, React.ElementType> = {
    [AiAgentType.CERTA]: WebPolicyComplianceAgent,
    [AiAgentType.RADAR]: ResearchAgent,
  };

  const AgentComponent = AGENT_COMPONENTS[type];

  // If the agent component is found, render it
  if (AgentComponent) {
    return <AgentComponent id={id} />;
  }

  return (
    <Box bg='dark.9' p='md'>
      <Text>Agent not found, please try again later.</Text>
    </Box>
  );
}
