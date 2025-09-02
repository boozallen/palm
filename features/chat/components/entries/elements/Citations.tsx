import { Avatar, HoverCard, Stack, Text, Title } from '@mantine/core';
import { IconFileDescription } from '@tabler/icons-react';

type CitationsProps = Readonly<{
  citations: Array<{
    knowledgeBaseId?: string | null;
    documentId?: string | null;
    sourceLabel: string;
    citation: string;
  }>;
}>;

export default function Citations({ citations }: CitationsProps) {
  const MAX_DISPLAYED_CITATION_ICONS = 3;
  const displayedCitations = citations.slice(0, MAX_DISPLAYED_CITATION_ICONS);

  const remainingCitations = citations.slice(MAX_DISPLAYED_CITATION_ICONS);
  const remainingCitationsCount = remainingCitations.length;

  const remainingCitationsHovercardContent = (
    <Stack spacing={'sm'}>
      {remainingCitations.map((citation) => (
        <div key={`${citation.citation}-${citation.sourceLabel}`}>
          <Title weight='normal' color='gray.6' order={4} truncate>
            {citation.sourceLabel}
          </Title>
          <Text size='xs'>{citation.citation}</Text>
        </div>
      ))}
    </Stack>
  );

  return (
    <Avatar.Group spacing='sm' pb='md'>
      {displayedCitations.map((citation, index) => (
        <div key={`${citation.citation}-${citation.sourceLabel}`}>
          <HoverCard shadow='md' withArrow position='top'>
            <HoverCard.Target>
              <Avatar
                data-testid={`displayed-avatar-${index}`}
                color='dark.6'
                bg='gray.0'
                radius='xl'
                size='sm'
              >
                <IconFileDescription />
              </Avatar>
            </HoverCard.Target>
            <HoverCard.Dropdown
              style={{ maxWidth: '50%', maxHeight: '25%', overflow: 'auto' }}
            >
              <Title weight='normal' color='gray.6' order={4} truncate>
                {citation.sourceLabel}
              </Title>
              <Text size='xs'>{citation.citation}</Text>
            </HoverCard.Dropdown>
          </HoverCard>
        </div>
      ))}
      {remainingCitationsCount > 0 && (
        <HoverCard shadow='md' withArrow position='top'>
          <HoverCard.Target>
            <Avatar
              data-testid='remaining-citations-avatar'
              color='dark.6'
              bg='gray.0'
              radius='xl'
              size='sm'
            >
              +{remainingCitationsCount}
            </Avatar>
          </HoverCard.Target>
          <HoverCard.Dropdown
            style={{ maxWidth: '50%', maxHeight: '45%', overflow: 'auto' }}
          >
            {remainingCitationsHovercardContent}
          </HoverCard.Dropdown>
        </HoverCard>
      )}
    </Avatar.Group>
  );
}
