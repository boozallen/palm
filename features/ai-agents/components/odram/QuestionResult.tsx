import { Paper, Stack, Group, Text, Badge, Divider, List } from '@mantine/core';

import type { OdramQuestionResult } from '@/features/ai-agents/types/odram/analysisResult';

function ratingColor(rating: string): string {
  switch (rating) {
    case 'Low':
      return 'green';
    case 'Moderate':
      return 'yellow';
    case 'High':
      return 'red';
    default:
      return 'gray';
  }
}

type QuestionResultProps = Readonly<{
  result: OdramQuestionResult;
}>;

export default function QuestionResult({ result }: QuestionResultProps) {
  const ratingsMatch = result.independentRating.toLowerCase() === result.teamRating.toLowerCase();

  return (
    <Paper bg='dark.7' p='md' radius='md'>
      <Stack spacing='sm'>
        <Group position='apart'>
          <Group spacing='xs'>
            <Text fw={700} size='md'>
              Q{result.questionId}
            </Text>
            <Text size='md'>{result.questionName}</Text>
          </Group>
        </Group>

        <Group spacing='lg'>
          <Group spacing='xs'>
            <Text size='sm' c='dimmed'>Team:</Text>
            <Badge color={ratingColor(result.teamRating)} variant='filled' c='black'>
              {result.teamRating}
            </Badge>
          </Group>
          <Group spacing='xs'>
            <Text size='sm' c='dimmed'>Independent:</Text>
            <Badge color={ratingColor(result.independentRating)} variant='filled' c='black'>
              {result.independentRating}
            </Badge>
          </Group>
          {!ratingsMatch && (
            <Badge color='orange' variant='light' size='sm'>
              Divergent
            </Badge>
          )}
        </Group>

        <Divider />

        <Stack spacing={4}>
          <Text size='sm' fw={600} color='blue.3'>Overall Assessment</Text>
          <Text size='sm' style={{ whiteSpace: 'pre-wrap' }}>
            {result.overallAssessment}
          </Text>
        </Stack>

        {result.keyFeedback && result.keyFeedback.length > 0 && (
          <Stack spacing={4}>
            <Text size='sm' fw={600} color='blue.3'>Key Feedback</Text>
            <List size='sm' spacing='xs' icon={<Text size='sm'>&#8226;</Text>}>
              {result.keyFeedback.map((item, i) => (
                <List.Item key={i}>
                  {item.replace(/^\d+\.\s*/, '')}
                </List.Item>
              ))}
            </List>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
