import {
  Accordion,
  Text,
  Group,
  Badge,
  Box,
  Stack,
  Divider,
  Button,
} from '@mantine/core';

import { ResearchPaper } from '@/features/ai-agents/types/radar/researchAgent';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type AccordionItemProps = Readonly<{
  paper: ResearchPaper;
  index: number;
}>;

export default function AccordionItem({ paper, index }: AccordionItemProps) {
  const track = useTrackClientEvent();

  return (
    <Accordion.Item value={paper.id}>
      <Accordion.Control>
        <Box>
          <Group spacing='xs' mb={4}>
            {/* Paper index number badge */}
            <Badge size='sm'>#{index + 1}</Badge>

            {/* Categories - all aligned at the same level */}
            {paper.categories.map((category) => (
              <Badge key={category} size='sm' color='blue' variant='light'>
                {category}
              </Badge>
            ))}
          </Group>
          <Text fw='medium'>{paper.title}</Text>
          <Text size='xs' color='dimmed' mt='sm'>
            {paper.authors.slice(0, 3).join(', ')}
            {paper.authors.length > 3 && ' et al.'}
            {' • '}
            {new Date(paper.published).toLocaleDateString()}
          </Text>
        </Box>
      </Accordion.Control>
      <Accordion.Panel pt='md'>
        <Stack spacing='sm'>
          <div>
            <Text fw='medium' size='sm'>
              Institutions:
            </Text>
            <Group spacing='xs' mt='sm'>
              {paper.institutions.map((inst) => (
                <Badge key={inst} color='blue' variant='light'>
                  {inst}
                </Badge>
              ))}
            </Group>
          </div>

          <div>
            <Text fw='medium' size='sm'>
              ArXiv Categories:
            </Text>
            <Text size='sm' color='dimmed'>
              {paper.categories.join(', ')}
            </Text>
          </div>

          <Divider />

          <div>
            <Text fw='medium' size='sm'>
              Abstract:
            </Text>
            <Text size='sm' style={{ lineHeight: 1.6 }}>
              {paper.summary}
            </Text>
          </div>

          <Group position='left' mt={8}>
            <Button
              component='a'
              href={paper.id}
              target='_blank'
              size='sm'
              onClick={() => track.externalLink(`View on arXiv: ${paper.title}`, paper.id)}
            >
              View on arXiv
            </Button>
          </Group>
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
