import { Box, Text } from '@mantine/core';

import WebPolicyComplianceAgent from './certa/Agent';
import { AgentType } from '@/features/shared/types';

type AgentProps = Readonly<{
  name: string;
  id: string;
}>;

// Component used to render the correct agent based on the title
export default function Agent({ name, id }: AgentProps) {
  // Map agent titles to their respective components
  const AGENT_COMPONENTS: Record<string, React.ElementType> = {
    [AgentType.CERTA]: WebPolicyComplianceAgent,
  };

  const AgentComponent = AGENT_COMPONENTS[name];

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
