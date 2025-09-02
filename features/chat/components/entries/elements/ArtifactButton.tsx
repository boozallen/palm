import { Box, Divider, ThemeIcon, Title, Text, UnstyledButton } from '@mantine/core';
import { IconFileCode, IconFileText } from '@tabler/icons-react';
import { Artifact } from '@/features/chat/types/message';
import { useChat } from '@/features/chat/providers/ChatProvider';

type ArtifactButtonProps = {
  artifact: Artifact;
};

export default function ArtifactButton({ artifact }: ArtifactButtonProps) {
  const { setSelectedArtifact } = useChat();

  const handleClick = () => {
    setSelectedArtifact(artifact);
  };

  const isPlainTextFile = artifact.fileExtension === '.txt';
  return (
    <UnstyledButton my='sm' variant='artifact' onClick={handleClick} data-testid='artifact-button'>
      <ThemeIcon m='xs' mt='sm' data-testid={`artifact-icon-${isPlainTextFile ? 'document' : 'code'}`}>
        {isPlainTextFile ? <IconFileText stroke={1.5} /> : <IconFileCode stroke={1.5} />}
      </ThemeIcon>
      <Divider orientation='vertical' color='dark.7' size='sm' />
      <Box px='sm' py='xs'>
        <Title order={5} data-testid='artifact-title'>{artifact.label}</Title>
        <Text size='xs' data-testid='artifact-description'>
          Click to open {isPlainTextFile ? 'document' : 'code'}
        </Text>
      </Box>
    </UnstyledButton>
  );
}
