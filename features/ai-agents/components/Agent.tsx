import React from 'react';
import { Box, Text } from '@mantine/core';

import WebPolicyComplianceAgent from './certa/Agent';
import ResearchAgent from './radar/Agent';
import RcastAgent from './rcast/Agent';
import SwearAgent from './swear/Agent';
import PrismAgent from './prism/Agent';
import OdramAgent from './odram/Agent';
import PulseAgent from './pulse/Agent';
import MarginAgent from './margin/Agent';
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
    [AiAgentType.RCAST]: RcastAgent,
    [AiAgentType.SWEAR]: SwearAgent,
    [AiAgentType.PRISM]: PrismAgent,
    [AiAgentType.ODRAM]: OdramAgent,
    [AiAgentType.PULSE]: PulseAgent,
    [AiAgentType.MARGIN]: MarginAgent,
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
