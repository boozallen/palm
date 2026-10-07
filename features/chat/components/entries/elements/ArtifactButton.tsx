import { Box, Divider, ThemeIcon, Title, Text, UnstyledButton, Button, Group, Tooltip } from '@mantine/core';
import { IconFileCode, IconFileText, IconVideo, IconMusic } from '@tabler/icons-react';
import { useState } from 'react';

import { Artifact } from '@/features/chat/types/message';
import { useChat } from '@/features/chat/providers/ChatProvider';
import {
  canOpenArtifactInViewer,
  downloadArtifact,
  isServerDownloadedArtifact,
} from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type ArtifactButtonProps = {
  artifact: Artifact;
};

export default function ArtifactButton({ artifact }: ArtifactButtonProps) {
  const { chatId, setSelectedArtifact } = useChat();
  const track = useTrackClientEvent();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const canOpenInViewer = canOpenArtifactInViewer(artifact);
  const isBinaryFile = !canOpenInViewer;
  // Agentic chat .mp4 artifacts store slides JSON in content — they must be exported
  // via the render pipeline (VideoPlayer's "Export as MP4"), not downloaded directly.
  const isAgenticVideo = artifact.fileExtension.toLowerCase() === '.mp4' && !!artifact.content;

  const handleClick = async () => {
    if (canOpenInViewer) {
      setSelectedArtifact(artifact);
    } else {
      setSelectedArtifact(null);
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      await downloadArtifact(artifact);
      // Binary artifacts come from the audited /api/chat/artifacts/download
      // route; only client-generated downloads are recorded here.
      if (!isServerDownloadedArtifact(artifact)) {
        track.download.chatArtifact(artifact, chatId);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  let referenceLabel = 'Code';
  let icon = <IconFileCode stroke={1.5} />;
  switch (artifact.fileExtension) {
    case '.txt':
    case '.md':
    case '.docx':
    case '.pptx':
    case '.csv':
    case '.xlsx':
    case '.pdf':
      referenceLabel = 'Document';
      icon = <IconFileText stroke={1.5} />;
      break;
    case '.mp4':
      referenceLabel =  'Video file';
      icon = <IconVideo stroke={1.5} />;
      break;
    case '.mp3':
    case '.mp4a':
    case '.wav':
      referenceLabel =  'Audio file';
      icon = <IconMusic stroke={1.5} />;
      break;
  }

  const button = (
    <UnstyledButton bg='dark.5' my='sm' miw='450px' variant='artifact' onClick={handleClick} data-testid='artifact-button'>
      <Group noWrap position='apart' w='100%'>
        <Group noWrap spacing='xs' >
          <ThemeIcon m='sm' mr='xs' data-testid={`artifact-icon-${referenceLabel.toLowerCase().replace(' ', '-')}`}>
            {icon}
          </ThemeIcon>
          <Divider orientation='vertical' color='dark.7' size='sm' />
          <Box p='sm' >
            <Title order={5} mb='xs' data-testid='artifact-title'>{artifact.label}</Title>
            <Text size='xs' data-testid='artifact-description'>
              {referenceLabel} &#x2022; {(artifact.fileExtension).replace('.', '').toUpperCase()}
            </Text>
          </Box>
        </Group>
        {!isAgenticVideo && (
          <Button
            size='xs'
            variant='default'
            onClick={handleDownload}
            data-testid='artifact-download-button'
            mx='sm'
            loading={isDownloading}
            disabled={isDownloading}
          >
            {isDownloading ? 'Downloading' : 'Download'}
          </Button>
        )}
      </Group>
    </UnstyledButton>
  );

  if (isBinaryFile) {
    return (
      <Tooltip label='This asset is download-only' position='top' opened={showTooltip}>
        {button}
      </Tooltip>
    );
  }

  return button;
}
