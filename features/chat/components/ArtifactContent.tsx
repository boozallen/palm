import { Box, Stack, ActionIcon, Text, Group, ScrollArea, Tooltip, CopyButton, UnstyledButton } from '@mantine/core';
import { IconDownload, IconX, IconCopy, IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { Artifact, PREVIEWABLE_FILE_EXTENSIONS } from '@/features/chat/types/message';
import { downloadArtifact } from '@/features/chat/utils/artifactHelperFunctions';
import Markdown from '@/components/content/Markdown';

type ArtifactContentProps = {
  artifact: Artifact;
};

const ArtifactContent = ({ artifact }: ArtifactContentProps) => {
  const { setSelectedArtifact } = useChat();
  const [viewMode, setViewMode] = useState('preview');

  useEffect(() => {
    setViewMode(PREVIEWABLE_FILE_EXTENSIONS.includes(artifact.fileExtension) ? 'preview' : 'code');
  }, [artifact]);

  const handleCloseArtifact = () => {
    setSelectedArtifact(null);
  };

  return (
    <>
      <Group
        position='apart'
        p='md'
        bg='dark.7'
        style={{ borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}
      >
        <Text c='gray.6'>{artifact.label}</Text>
        <Group spacing='xs'>
          {PREVIEWABLE_FILE_EXTENSIONS.includes(artifact.fileExtension) && (
            <Box bg='dark.8' mr='sm' style={{ borderRadius: '12px' }}>
              <UnstyledButton
                data-testid='toggle-artifact-view-preview'
                variant='toggle_artifact_view'
                className={viewMode === 'preview' ? 'active' : ''}
                onClick={() => setViewMode('preview')}
                aria-label='Preview'
              >
                Preview
              </UnstyledButton>
              <UnstyledButton
                data-testid='toggle-artifact-view-code'
                variant='toggle_artifact_view'
                className={viewMode === 'preview' ? '' : 'active'}
                onClick={() => setViewMode('code')}
                aria-label='Code'
              >
                Code
              </UnstyledButton>
            </Box>
          )}
          <ActionIcon size='sm' onClick={handleCloseArtifact}>
            <IconX stroke={1.5} aria-label='Close' />
          </ActionIcon>
        </Group>
      </Group>

      <Box sx={{ flex: 1, overflow: 'auto' }} bg='dark.6'
        tabIndex={0}
        aria-label='Artifacts content'
      >
        <Stack h='100%'>
          <ScrollArea h='100%'>
            <Markdown 
              key={`${artifact.id}-${viewMode}`} 
              value={artifact.content} 
              fileExtension={artifact.fileExtension} 
              isPreview={viewMode === 'preview'} 
            />
          </ScrollArea>
        </Stack>
      </Box>

      <Group
        position='apart'
        p='md'
        bg='dark.7'
        style={{
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
        }}
      >
        <Text c='gray.6' size='xs'>Created at {artifact.createdAt.toLocaleDateString()}</Text>
        <Group spacing='sm'>
          <CopyButton value={artifact.content} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position='left'>
                <ActionIcon size='sm' color={copied ? 'teal' : 'gray'} onClick={copy}>
                  {copied ? <IconCheck /> : <IconCopy aria-label='Copy' />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
          <Tooltip label='Download' withArrow position='left'>
            <ActionIcon size='sm' onClick={() => downloadArtifact(artifact)}>
              <IconDownload stroke={1.5} aria-label='Download' />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </>
  );
};

export default ArtifactContent;
