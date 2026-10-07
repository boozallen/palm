import { Card, Text, Title } from '@mantine/core';
import { useRouter } from 'next/router';

import { generateAgentUrl } from '@/features/ai-agents/utils/agents';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type AgentCardProps = Readonly<{
  id: string;
  label: string;
  description: string;
}>;

export default function AgentCard({
  id, label, description,
}: AgentCardProps) {
  const router = useRouter();
  const track = useTrackClientEvent();

  const url = generateAgentUrl(label, id);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    track.navigate(label, url);
    router.push(url);
    event.stopPropagation();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      track.navigate(label, url);
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
      data-testid={`agent-card-${label}`}
      aria-label={'ai-agent-card: ' + label}
      radius='md'
      withBorder
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <Title color='gray.6' pb='sm'>
        {label}
      </Title>
      <Text size='xssm' color='gray.6'>
        {description}
      </Text>
    </Card>
  );
}
