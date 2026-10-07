import { Box, Stack, Text, Group, ActionIcon, ScrollArea, UnstyledButton, ThemeIcon, Divider, Button, Tooltip } from '@mantine/core';
import { IconLayoutSidebarLeftCollapse, IconFileCode, IconFileText, IconVideo, IconDownload } from '@tabler/icons-react';

import { Artifact } from '@/features/chat/types/message';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type ArtifactsContainerProps = {
  artifacts: Artifact[];
};

const ArtifactsContainer = ({ artifacts }: ArtifactsContainerProps) => {
  const { chatId, setSelectedArtifact, setShowArtifactsContainer } = useChat();
  const track = useTrackClientEvent();

  const handleCloseContainer = () => {
    setShowArtifactsContainer(false);
    track.togglePanel('Close artifacts list');
  };

  const handleArtifactClick = (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setShowArtifactsContainer(false);
  };

  const handleDownload = (artifact: Artifact, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.label}${artifact.fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    track.download.chatArtifact(artifact, chatId);
  };

  const handleDownloadAll = () => {
    artifacts.forEach((artifact) => {
      const blob = new Blob([artifact.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artifact.label}${artifact.fileExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    // One record for the bulk action, but it names every file that left.
    track.download.allChatArtifacts(artifacts, chatId);
  };

  const getArtifactIcon = (fileExtension: string) => {
    if (fileExtension === '.mp4') {
      return <IconVideo stroke={1.5} />;
    }
    if (fileExtension === '.txt') {
      return <IconFileText stroke={1.5} />;
    }
    return <IconFileCode stroke={1.5} />;
  };

  const getArtifactType = (fileExtension: string) => {
    if (fileExtension === '.mp4') {
      return 'Video';
    }
    if (fileExtension === '.txt') {
      return 'Document';
    }
    return 'Code';
  };

  const getArtifactDescription = (fileExtension: string) => {
    const type = getArtifactType(fileExtension);
    const extension = fileExtension.replace('.', '').toUpperCase();
    return `${type} - ${extension}`;
  };

  return (
    <>
      <Group
        px='md'
        py='sm'
        position='apart'
        bg='dark.4'
      >
        <Text size='sm' color='gray.2' fw={500}>
          Artifacts ({artifacts.length})
        </Text>
        <Group spacing='xs'>
          <Button
            size='xs'
            variant='subtle'
            leftIcon={<IconDownload size={14} stroke={1.5} />}
            onClick={handleDownloadAll}
            disabled={artifacts.length === 0}
          >
            Download all
          </Button>
          <Tooltip label='Close artifacts list' position='left'>
            <ActionIcon size='sm' onClick={handleCloseContainer}>
              <IconLayoutSidebarLeftCollapse stroke={1} aria-label='Close artifacts list' />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <ScrollArea h='100%' bg='dark.8'>
        <Stack spacing='sm' p='md'>
          {artifacts.map((artifact) => (
            <Box key={artifact.id} sx={{ position: 'relative' }}>
              <UnstyledButton
                variant='artifact'
                onClick={() => handleArtifactClick(artifact)}
                data-testid={`artifact-list-item-${artifact.id}`}
                sx={{ width: '100%' }}
              >
                <Group noWrap spacing='xs'>
                  <ThemeIcon m='xs' data-testid={`artifact-list-icon-${artifact.fileExtension.replace('.', '')}`}>
                    {getArtifactIcon(artifact.fileExtension)}
                  </ThemeIcon>
                  <Divider orientation='vertical' color='dark.7' size='sm' />
                  <Box px='sm' py='xs' sx={{ flex: 1, minWidth: 0, paddingRight: '2.5rem' }}>
                    <Text fw={500} size='sm' lineClamp={1}>{artifact.label}</Text>
                    <Text size='xs' color='dimmed'>
                      {getArtifactDescription(artifact.fileExtension)}
                    </Text>
                  </Box>
                </Group>
              </UnstyledButton>
              <Box sx={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}>
                <ActionIcon
                  size='sm'
                  onClick={(e: React.MouseEvent) => handleDownload(artifact, e)}
                  data-testid={`artifact-download-${artifact.id}`}
                >
                  <IconDownload stroke={1.5} size={16} aria-label='Download artifact' />
                </ActionIcon>
              </Box>
            </Box>
          ))}
        </Stack>
      </ScrollArea>
    </>
  );
};

export default ArtifactsContainer;
