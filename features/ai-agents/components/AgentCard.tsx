import { Card, Text, Title } from '@mantine/core';
import { useRouter } from 'next/router';

import { generateAgentUrl } from '@/features/ai-agents/utils/agents';

type AgentCardProps = Readonly<{
  id: string;
  name: string;
  description: string;
}>;

export default function AgentCard({
  id, name, description,
}: AgentCardProps) {
  const router = useRouter();

  const url = generateAgentUrl(name, id);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    router.push(url);
    event.stopPropagation();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      router.push(url);
      event.stopPropagation();
    }
  };

  return (
    <Card
      variant='agent_card'
      shadow='sm'
      p='lg'
      tabIndex={0}
      data-testid={`agent-card-${name}`}
      aria-label={'ai-agent-card: ' + name}
      radius='md'
      withBorder
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <Title color='gray.6' pb='sm'>
        {name}
      </Title>
      <Text size='xssm' color='gray.6'>
        {description}
      </Text>
    </Card>
  );
}
