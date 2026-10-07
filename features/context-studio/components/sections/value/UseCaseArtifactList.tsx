import { Stack, Text, Group } from '@mantine/core';
import { UseCaseArtifactRow } from '@/features/context-studio/types/use-case-detail';

const ARTIFACT_ROWS = 20;
const EM_DASH = '—';
const SIGNAL_SEPARATOR = ' · ';

type UseCaseArtifactListProps = Readonly<{
  artifacts: UseCaseArtifactRow[];
}>;

export default function UseCaseArtifactList({ artifacts }: UseCaseArtifactListProps) {
  if (artifacts.length === 0) {
    return (
      <Text size='sm' c='dimmed' data-testid='use-case-artifacts-empty'>
        {EM_DASH}
      </Text>
    );
  }

  const displayedArtifacts = artifacts.slice(0, ARTIFACT_ROWS);
  const overflowCount = artifacts.length - ARTIFACT_ROWS;

  return (
    <Stack spacing='xs'>
      {displayedArtifacts.map((artifact) => {
        const hasSignals = artifact.signals.length > 0;
        const signalsText = hasSignals
          ? artifact.signals.join(SIGNAL_SEPARATOR)
          : null;

        return (
          <Stack key={artifact.artifactId} spacing='xxs' data-testid='use-case-artifact-row'>
            <Text size='sm'>{artifact.name}</Text>
            <Group spacing='xs'>
              {hasSignals ? (
                <Text size='xs' c='dimmed'>
                  {signalsText}
                </Text>
              ) : (
                <Text size='xs' c='dimmed' data-testid='use-case-artifact-unused'>
                  not used
                </Text>
              )}
            </Group>
          </Stack>
        );
      })}
      {overflowCount > 0 && (
        <Text size='xs' c='dimmed' data-testid='use-case-artifact-overflow'>
          {overflowCount} more
        </Text>
      )}
    </Stack>
  );
}
