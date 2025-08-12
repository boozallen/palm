import {
  Group,
  Skeleton,
  Stack,
  Title,
  Text,
  Paper,
  ScrollArea,
} from '@mantine/core';

import {
  ComplianceResult,
  RequirementStatus,
} from '@/features/ai-agents/types/certa/webPolicyCompliance';

type ResultProps = Readonly<{
  isLoading: boolean;
  result?: ComplianceResult;
}>;

export default function Result({
  result,
  isLoading,
}: ResultProps) {
  if (!isLoading && !result) {
    return <></>;
  }

  // If loading, show skeleton
  if (isLoading) {
    return (
      <Stack spacing='sm'>
        <Group>
          <Title order={3} color='gray.6' fz='xl' fw='bolder'>
            Compliance Result
          </Title>
        </Group>
        <ResultsSkeleton />
      </Stack>
    );
  }

  if (result) {
    const hasNonCompliantRequirements = result.requirements?.some(
      (req) =>
        req.status === RequirementStatus.NotMet ||
        req.status === RequirementStatus.PartiallyMet
    );

    return (
      <Stack spacing='sm'>
        <Group>
          <Title order={3} color='gray.6' fz='xl' fw='bolder'>
            Compliance Result
          </Title>
        </Group>

        {
          <ScrollArea h={350}>
            <Paper p='md' withBorder bg='dark.7'
              tabIndex={0}
              aria-label='Compliance result'
            >
              <Text mb='md'>{result.overallExplanation}</Text>

              {result.requirements.length > 0 && (
                <>
                  <Title order={2} fw='bolder' mb='sm'>
                    Requirements:
                  </Title>
                  {result.requirements.map((req) => (
                    <Stack key={req.requirement} spacing='xs' mb='md'>
                      <Title order={3} fw='bold'>
                        {req.requirement}
                      </Title>
                      <Text weight='bold'>Status: {req.status}</Text>
                      {req.explanation && (
                        <Text>Analysis: {req.explanation}</Text>
                      )}
                    </Stack>
                  ))}
                </>
              )}

              {result.remediationSteps && hasNonCompliantRequirements && (
                <>
                  <Title order={2} fw='bolder' mb='sm' mt='sm'>
                    Remediation Steps:
                  </Title>
                  <Stack spacing='xs'>
                    {result.remediationSteps.map((step, index) => (
                      <Text key={step}>
                        {index + 1}. {step}
                      </Text>
                    ))}
                  </Stack>
                </>
              )}
            </Paper>
          </ScrollArea>
        }
      </Stack>
    );
  }
  return null;
}
function ResultsSkeleton() {
  return (
    <Stack spacing='sm' mt='sm'>
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} width='75%' />
      <Skeleton height={12} mt='md' />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} />
      <Skeleton height={12} width='75%' />
    </Stack>
  );
}
