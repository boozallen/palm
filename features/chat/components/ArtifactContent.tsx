import { notifications } from '@mantine/notifications';
import { Box, Stack, ActionIcon, Group, ScrollArea, Tooltip, CopyButton, UnstyledButton, ThemeIcon, Text, Progress } from '@mantine/core';
import { IconBrandGithub, IconDownload, IconX, IconCopy, IconCheck, IconEye, IconCode, IconExternalLink, IconLayoutSidebarLeftExpand, IconPencil } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePushArtifactToGithub } from '@/features/chat/hooks/usePushArtifactToGithub';
import { useSaveChatArtifactVersion } from '@/features/chat/hooks/useSaveChatArtifactVersion';
import useGetArtifactVersions from '@/features/chat/api/get-artifact-versions';
import useGetAvailableGitHubProviders from '@/features/shared/api/get-available-github-providers';
import PushToGithubModal from '@/features/shared/components/modals/PushToGithubModal';
import ArtifactEditor from '@/features/shared/components/ArtifactEditor';
import ArtifactVersionSelector from '@/features/shared/components/ArtifactVersionSelector';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

import { trpc } from '@/libs';
import { SelectedArtifact, useChat } from '@/features/chat/providers/ChatProvider';
import { PREVIEW_AS_RENDERED_FILE_TYPES, isEditableArtifact } from '@/features/shared/types/document';
import { downloadArtifact, getArtifactPreviewFlags, isServerDownloadedArtifact } from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import Markdown from '@/components/content/Markdown';

const VideoPlayer = dynamic(
  () => import('@/features/video-generation/components/VideoPlayer'),
  { ssr: false },
);

import DocxPreview from '@/features/chat/components/DocxPreview';
import PptxPreview from '@/features/chat/components/PptxPreview';
import XlsxPreview from '@/features/chat/components/XlsxPreview';

type ArtifactContentProps = {
  artifact: SelectedArtifact;
};

const ArtifactContent = ({ artifact }: ArtifactContentProps) => {
  const { chatId, setSelectedArtifact, setShowArtifactsContainer } = useChat();
  const track = useTrackClientEvent();
  const [viewMode, setViewMode] = useState('preview');
  const [videoRenderJobId, setVideoRenderJobId] = useState<string | null>(null);
  const [videoRenderJobFailed, setVideoRenderJobFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [viewedVersionIndex, setViewedVersionIndex] = useState<number | null>(null);

  const [showPushModal, setShowPushModal] = useState(false);
  const pushToGithub = usePushArtifactToGithub(chatId ?? '');
  const saveArtifactVersion = useSaveChatArtifactVersion(chatId ?? '');
  const { data: githubProviders } = useGetAvailableGitHubProviders();
  const hasGithubProviders = (githubProviders?.availableGitHubProviders?.length ?? 0) > 0;
  const {
    fileExtension,
    isPreviewableDocx,
    isPreviewableXlsx,
    isPreviewableCsv,
    isPreviewablePptx,
    isPreviewableMp4,
    isBinaryNoPreview,
  } = getArtifactPreviewFlags(artifact);
  const isHtmlArtifact = fileExtension === '.html';
  // An artifact opened from a prior conversation's citation is read-only here; the
  // conversation that produced it is where it is edited or published.
  const isExternal = !!artifact.isExternal;

  const isPublished = !!artifact.githubPagesUrl;
  const isGithubActionEnabled = isHtmlArtifact && (isPublished || (!isExternal && hasGithubProviders));
  const isArtifactEditable = !isExternal && isEditableArtifact(fileExtension, artifact.content);

  const { data: versionsData } = useGetArtifactVersions(
    isArtifactEditable ? artifact.id : '',
    artifact.chatMessageId,
  );
  const versions = versionsData?.versions ?? [];
  const effectiveVersionIndex = viewedVersionIndex ?? versions.length - 1;
  const viewedVersion = versions.length > 0 ? versions[effectiveVersionIndex] : null;
  const displayedContent = !isEditing && viewedVersion ? viewedVersion.content : artifact.content;
  const isViewingOldVersion = versions.length > 0 && effectiveVersionIndex !== versions.length - 1;

  useEffect(() => {
    setViewMode(PREVIEW_AS_RENDERED_FILE_TYPES.includes(fileExtension) ? 'preview' : 'code');
  }, [artifact]);

  useEffect(() => {
    setVideoRenderJobId(null);
    setVideoRenderJobFailed(false);
    setIsEditing(false);
    setViewedVersionIndex(null);
  }, [artifact.id]);

  const videoRenderJobMutation = trpc.video.renderToMp4.useMutation({
    onSuccess: (data) => {
      setVideoRenderJobId(data.jobId);
      setVideoRenderJobFailed(false);
    },
    onError: () => {
      setVideoRenderJobFailed(true);
    },
  });

  const { data: videoRenderJobStatus } = trpc.video.getRenderStatus.useQuery(
    { jobId: videoRenderJobId! },
    {
      enabled: !!videoRenderJobId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (!status || status === 'queued' || status === 'processing') {
          return 2000;
        }
        return false;
      },
    },
  );

  useEffect(() => {
    if (videoRenderJobStatus?.status === 'done' && videoRenderJobStatus.downloadUrl) {
      const a = document.createElement('a');
      a.href = videoRenderJobStatus.downloadUrl;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setVideoRenderJobId(null);
      track.download.chatArtifact(artifact, chatId);
    }
    if (videoRenderJobStatus?.status === 'error') {
      setVideoRenderJobFailed(true);
      setVideoRenderJobId(null);
    }
  }, [videoRenderJobStatus?.status, videoRenderJobStatus?.downloadUrl]);

  const isVideoRenderJobActive = videoRenderJobMutation.isPending || !!videoRenderJobId;
  const videoRenderJobProgressLabel = videoRenderJobStatus?.progress ?? 'Rendering\u2026';
  const exportTooltip = videoRenderJobFailed ? 'Export failed — try again' : isVideoRenderJobActive ? videoRenderJobProgressLabel : 'Export as MP4';

  const handleCloseArtifact = () => {
    track.togglePanel('Close artifact panel');
    setSelectedArtifact(null);
  };

  const handleShowAllArtifacts = () => {
    setShowArtifactsContainer(true);
    track.togglePanel('Open artifacts list');
  };

  const handlePushToGithubClick = () => {
    setShowPushModal(true);
  };

  const handleSaveArtifact = async (content: string) => {
    try {
      const result = await saveArtifactVersion.mutateAsync({
        artifactId: artifact.id,
        chatMessageId: artifact.chatMessageId,
        content,
      });
      setIsEditing(false);
      track.saveArtifactVersion.chatArtifact(artifact, chatId, result.versionNumber);
      notifications.show({
        title: 'New version saved',
        message: '',
        icon: <IconCheck />,
        autoClose: true,
        variant: 'successful_operation',
      });
    } catch (error) {
      notifications.show({
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Failed to save artifact version',
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleRestoreVersion = async () => {
    if (!viewedVersion) { return; }
    try {
      await saveArtifactVersion.mutateAsync({
        artifactId: artifact.id,
        chatMessageId: artifact.chatMessageId,
        content: viewedVersion.content,
      });
      setViewedVersionIndex(null);
      track.restoreArtifactVersion.chatArtifact(artifact, chatId, viewedVersion.versionNumber);
      notifications.show({
        title: 'Version restored',
        message: '',
        icon: <IconCheck />,
        autoClose: true,
        variant: 'successful_operation',
      });
    } catch (error) {
      notifications.show({
        title: 'Restore failed',
        message: error instanceof Error ? error.message : 'Failed to restore artifact version',
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  const handlePushToGithub = async (providerId: string) => {
    setShowPushModal(false);
    try {
      await pushToGithub.mutateAsync({
        artifactId: artifact.id,
        chatMessageId: artifact.chatMessageId,
        githubProviderId: providerId,
      });
      notifications.show({
        title: 'Published to GitHub',
        message: '',
        icon: <IconCheck />,
        autoClose: 8000,
        variant: 'successful_operation',
      });
    } catch (error) {
      notifications.show({
        title: 'Push to GitHub failed',
        message: error instanceof Error ? error.message : 'Failed to push artifact to GitHub',
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <>
      <PushToGithubModal
        modalOpened={showPushModal}
        closeModalHandler={() => setShowPushModal(false)}
        onConfirm={handlePushToGithub}
        providers={githubProviders?.availableGitHubProviders ?? []}
        isLoading={pushToGithub.isPending}
      />
      <Group
        px='md'
        py='sm'
        position='apart'
        bg='dark.4'
        noWrap
        sx={(theme) => ({ borderBottom: `2px solid ${theme.colors.dark[5]}` })}
      >
        <Group spacing='sm' noWrap>
          {PREVIEW_AS_RENDERED_FILE_TYPES.includes(fileExtension) && (
            <Box bg='dark.8' style={{ borderRadius: '8px' }}>
              <UnstyledButton
                data-testid='toggle-artifact-view-preview'
                variant='toggle_artifact_view'
                className={viewMode === 'preview' ? 'active' : ''}
                onClick={() => {
                  if (viewMode !== 'preview') {
                    setViewMode('preview');
                    track.toggleArtifactViewMode.chatArtifact(artifact, chatId, 'preview');
                  }
                }}
                aria-label='Preview'
              >
                <ThemeIcon size='md'>
                  <IconEye  stroke={1.5} size={'sm'} />
                </ThemeIcon>
              </UnstyledButton>
              <UnstyledButton
                data-testid='toggle-artifact-view-code'
                variant='toggle_artifact_view'
                className={viewMode === 'preview' ? '' : 'active'}
                onClick={() => {
                  if (viewMode !== 'code') {
                    setViewMode('code');
                    track.toggleArtifactViewMode.chatArtifact(artifact, chatId, 'code');
                  }
                }}
                aria-label='Code'
              >
                <ThemeIcon size='md'>
                  <IconCode  stroke={1.5} size={'sm'} />
                </ThemeIcon>
              </UnstyledButton>
            </Box>
          )}
          {isArtifactEditable && !isEditing && versions.length > 0 && (
            <ArtifactVersionSelector
              versions={versions}
              selectedIndex={effectiveVersionIndex}
              onSelectIndex={(index) => {
                setViewedVersionIndex(index);
                track.navigateArtifactVersion.chatArtifact(artifact, chatId, versions[index].versionNumber);
              }}
              onRestore={handleRestoreVersion}
              isRestoring={saveArtifactVersion.isPending}
            />
          )}
        </Group>
        <Group spacing='sm' noWrap>
          <Tooltip label='Open artifacts list' position='left'>
            <ActionIcon size='sm' onClick={handleShowAllArtifacts}>
              <IconLayoutSidebarLeftExpand stroke={1} aria-label='Open artifacts list' />
            </ActionIcon>
          </Tooltip>
          {!isPreviewableMp4 && !isPreviewableXlsx && !isPreviewableDocx && !isPreviewableCsv && !isPreviewablePptx && !isBinaryNoPreview && (
            <CopyButton value={displayedContent} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy'} position='left'>
                  <ActionIcon
                    size='sm'
                    color={copied ? 'teal' : 'gray'}
                    onClick={() => {
                      copy();
                      track.copy.chatArtifact(artifact, chatId);
                    }}
                  >
                    {copied ? <IconCheck /> : <IconCopy aria-label='Copy' />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          )}
          {fileExtension === '.mp4' ? (
            isVideoRenderJobActive ? (
              <Stack spacing='0' style={{ minWidth: 100 }}>
                <Text size='xs' color='gray.6'>
                  {!videoRenderJobId || videoRenderJobMutation.isPending
                    ? 'Starting...'
                    : videoRenderJobStatus?.status === 'queued'
                    ? 'Queued...'
                    : videoRenderJobProgressLabel}
                </Text>
                {videoRenderJobStatus?.status === 'processing' && (
                  <Progress
                    value={parseInt((videoRenderJobStatus.progress ?? '0%').match(/(\d+)/)?.[1] ?? '0')}
                    size='xs'
                    color='violet'
                  />
                )}
              </Stack>
            ) : (
              <Tooltip label={exportTooltip} position='left'>
                <ActionIcon
                  size='sm'
                  color={videoRenderJobFailed ? 'red' : 'gray'}
                  onClick={() => videoRenderJobMutation.mutate({ slidesJson: artifact.content })}
                >
                  <IconDownload stroke={1.5} aria-label='Export as MP4' />
                </ActionIcon>
              </Tooltip>
            )
          ) : (
            <Tooltip label='Download' position='left'>
              <ActionIcon
                size='sm'
                onClick={async () => {
                  await downloadArtifact(artifact);
                  // Binary artifacts download via the audited server route and
                  // are recorded there; only record client-generated downloads.
                  if (!isServerDownloadedArtifact(artifact)) {
                    track.download.chatArtifact(artifact, chatId);
                  }
                }}
              >
                <IconDownload stroke={1.5} aria-label='Download' />
              </ActionIcon>
            </Tooltip>
          )}
          {isGithubActionEnabled && (
            isPublished ? (
              <Tooltip label='View on GitHub Pages' position='left'>
                <ActionIcon
                  size='sm'
                  component='a'
                  href={artifact.githubPagesUrl!}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={() => track.externalLink('View on GitHub Pages', artifact.githubPagesUrl!)}
                >
                  <IconExternalLink stroke={1.5} aria-label='View on GitHub Pages' />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Tooltip label='Publish to GitHub Pages' position='left'>
                <ActionIcon size='sm' onClick={handlePushToGithubClick}
                  loading={pushToGithub.isPending} disabled={pushToGithub.isPending}>
                  <IconBrandGithub stroke={1.5} aria-label='Publish to GitHub Pages' />
                </ActionIcon>
              </Tooltip>
            )
          )}
          {isArtifactEditable && !isEditing && (
            <Tooltip label={isViewingOldVersion ? 'Switch to the latest version to edit' : 'Edit'} position='left'>
              <ActionIcon
                size='sm'
                disabled={isViewingOldVersion}
                onClick={() => {
                  setIsEditing(true);
                  track.editArtifact.chatArtifact(artifact, chatId);
                }}
              >
                <IconPencil stroke={1.5} aria-label='Edit' />
              </ActionIcon>
            </Tooltip>
          )}
          <ActionIcon size='sm' onClick={handleCloseArtifact}>
            <IconX stroke={1.5} aria-label='Close' />
          </ActionIcon>
        </Group>
      </Group>
      <Box
        sx={{ flex: 1, overflow: 'auto' }}
        bg={(
          (
            fileExtension === '.mmd' ||
            fileExtension === '.mermaid' ||
            fileExtension === '.html') &&
            viewMode === 'preview'
          ) ? 'dark.6' : 'dark.9'}
        tabIndex={0}
        aria-label='Artifacts content'
      >
        <Stack h='100%' bg='dark.4'>
          {isEditing ? (
            <ArtifactEditor
              content={artifact.content}
              fileExtension={fileExtension}
              onSave={handleSaveArtifact}
              onCancel={() => {
                setIsEditing(false);
                track.cancelEditArtifact.chatArtifact(artifact, chatId);
              }}
              isSaving={saveArtifactVersion.isPending}
            />
          ) : isPreviewableMp4 ? (
            <VideoPlayer content={artifact.content} artifactId={artifact.id} />
          ) : isBinaryNoPreview ? (
            <Box p='xl' ta='center'>
              <Text color='dimmed' size='sm'>This file is download-only</Text>
            </Box>
          ) : isPreviewableDocx ? (
            <DocxPreview artifactId={artifact.id} />
          ) : isPreviewablePptx ? (
            <PptxPreview artifactId={artifact.id} />
          ) : isPreviewableXlsx ? (
            <XlsxPreview artifactId={artifact.id} />
          ) : isPreviewableCsv ? (
            <XlsxPreview artifactId={artifact.id} csvContent={displayedContent} />
          ) : fileExtension === '.html' && viewMode === 'preview' ? (
            <Markdown
              key={`${artifact.id}-${viewMode}-${effectiveVersionIndex}`}
              value={displayedContent}
              fileExtension={fileExtension}
              isPreview
            />
          ) : (
            <ScrollArea h='100%'>
              <Markdown
                key={`${artifact.id}-${viewMode}-${effectiveVersionIndex}`}
                value={displayedContent}
                fileExtension={fileExtension}
                isPreview={viewMode === 'preview'}
              />
            </ScrollArea>
          )}
        </Stack>
      </Box>
    </>
  );
};

export default ArtifactContent;
