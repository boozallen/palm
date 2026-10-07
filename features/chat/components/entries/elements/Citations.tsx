import { Avatar, Box, HoverCard, Stack, Text, Title, Divider, Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileDescription, IconEye, IconMessageCircle } from '@tabler/icons-react';
import { useRouter } from 'next/router';
import { useRef } from 'react';

import useGetCitedArtifact from '@/features/chat/api/get-cited-artifact';
import { InlineFileName } from '@/features/chat/components/agent-trace/ToolResultCard';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { Citation, ContextType } from '@/features/chat/types/message';
import {
  canOpenArtifactInViewer,
  downloadArtifact,
} from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { generateCitationUrl } from '@/features/chat/utils/chatHelperFunctions';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';

type CitationsProps = Readonly<{
  citations: Citation[];
  messageId?: string;
}>;

const CitationContent = ({
  citation,
  sourceLabel,
  metadata,
  onViewInDocument,
}: {
  citation: string;
  sourceLabel: string;
  metadata?: string;
  onViewInDocument?: () => void;
}) => {
  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onViewInDocument) {
      onViewInDocument();
    }
  };

  return (
    <Stack spacing='xs'>
      <Group position='apart' align='center' noWrap my='sm'>
        <Title weight='bold' color='blue' order={3}>
          {sourceLabel}
        </Title>
        {onViewInDocument && (
          <Button
            size='xs'
            variant='light'
            color='blue'
            rightIcon={<IconEye size={16} />}
            onClick={handleViewClick}
            compact
          >
            View Source
          </Button>
        )}
      </Group>
      {metadata && (
        <Text data-testid='citation-metadata' size='xs' color='dimmed'>
          {metadata}
        </Text>
      )}
      <Text size='sm' color='gray.7'>
        {citation}
      </Text>
    </Stack>
  );
};

type PriorConversationCitation = Extract<
  Citation,
  { contextType: ContextType.PRIOR_CONVERSATION }
>;

const PriorConversationContent = ({
  citation,
  onOpen,
  onOpenArtifact,
}: {
  citation: PriorConversationCitation;
  onOpen: (event: React.MouseEvent) => void;
  onOpenArtifact: (artifactId: string, event: React.MouseEvent) => Promise<void>;
}) => {
  const date = citation.messageCreatedAt
    ? new Date(citation.messageCreatedAt).toLocaleDateString()
    : 'Unknown date';

  return (
    <Stack spacing='xs'>
      <Group position='apart' align='center' noWrap my='sm'>
        <Title weight='bold' color='blue' order={3}>
          {citation.sourceLabel}
        </Title>
        <Button
          size='xs'
          variant='light'
          color='blue'
          rightIcon={<IconMessageCircle size={16} />}
          onClick={onOpen}
          compact
        >
          Open conversation
        </Button>
      </Group>
      <Text size='xs' color='dimmed'>
        From a prior conversation · {date}
      </Text>
      <Text size='sm' color='gray.7'>
        {citation.citation}
      </Text>
      {citation.artifacts && citation.artifacts.length > 0 && (
        <Group spacing='xs'>
          {citation.artifacts.map((artifact) => (
            <Box
              key={artifact.id}
              data-testid={`citation-artifact-${artifact.id}`}
              my='sm'
              sx={(theme) => ({
                cursor: 'pointer',
                borderRadius: theme.radius.sm,
                '&:hover': {
                  backgroundColor: theme.colors.dark[6],
                },
              })}
              onClick={(event: React.MouseEvent<HTMLDivElement>) => onOpenArtifact(artifact.id, event)}
            >
              <InlineFileName title={`${artifact.label}${artifact.fileExtension}`} />
            </Box>
          ))}
        </Group>
      )}
    </Stack>
  );
};

export default function Citations({ citations, messageId }: CitationsProps) {
  const router = useRouter();
  const artifactRequestSeq = useRef(0);
  const {
    chatId,
    setHighlightedCitation,
    setSelectedArtifact,
    setShowArtifactsContainer,
    setSourcesSidebarExpanded,
  } = useChat();
  const { fetch: fetchCitedArtifact } = useGetCitedArtifact();
  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const { data: userDocuments } = useGetDocuments({ documentUploadProviderId });

  const MAX_DISPLAYED_CITATION_ICONS = 3;
  const displayedCitations = citations.slice(0, MAX_DISPLAYED_CITATION_ICONS);

  const remainingCitations = citations.slice(MAX_DISPLAYED_CITATION_ICONS);
  const remainingCitationsCount = remainingCitations.length;

  // The documents list omits full text for list-query performance (it is
  // fetched lazily when a document is opened), so this only confirms the
  // cited document still exists for the user rather than checking its text.
  const canViewDocument = (citation: Citation): boolean => {
    if (citation.contextType !== 'DOCUMENT_LIBRARY') {
      return false;
    }
    return !!userDocuments?.documents?.find(doc => doc.id === citation.documentId);
  };

  const handleCitationOpen = (citation: Citation) => {
    if (citation.contextType === 'DOCUMENT_LIBRARY') {
      // First expand the sidebar
      setSourcesSidebarExpanded(true);

      // Then set the highlighted citation with a small delay to ensure sidebar is open
      setTimeout(() => {
        setHighlightedCitation({
          documentId: citation.documentId,
          embeddingId: citation.embeddingId,
          citation: citation.citation,
          startPosition: citation.startPosition,
          endPosition: citation.endPosition,
          sectionPath: citation.sectionPath,
          pageStart: citation.pageStart,
          pageEnd: citation.pageEnd,
        });
      }, 50);
    }
  };

  const handleConversationOpen = (
    citation: PriorConversationCitation,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    void router.push(generateCitationUrl(citation.chatId, citation.citedMessageId, chatId, messageId));
  };

  const handleArtifactOpen = async (
    artifactId: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const requestId = ++artifactRequestSeq.current;

    try {
      const artifact = await fetchCitedArtifact({ artifactId });
      if (requestId !== artifactRequestSeq.current) {
        return;
      }
      const viewerArtifact = {
        ...artifact,
        createdAt: new Date(artifact.createdAt),
      };
      if (canOpenArtifactInViewer(viewerArtifact)) {
        setSelectedArtifact({ ...viewerArtifact, isExternal: true });
        setShowArtifactsContainer(false);
      } else {
        await downloadArtifact(viewerArtifact);
      }
    } catch {
      if (requestId !== artifactRequestSeq.current) {
        return;
      }
      notifications.show({
        title: 'Could not open artifact',
        message: 'The artifact could not be loaded. Please try again.',
        variant: 'failed_operation',
      });
    }
  };

  const renderCitationContent = (citation: Citation) => {
    if (citation.contextType === ContextType.PRIOR_CONVERSATION) {
      return (
        <PriorConversationContent
          citation={citation}
          onOpen={(event) => handleConversationOpen(citation, event)}
          onOpenArtifact={handleArtifactOpen}
        />
      );
    }
    const metadataParts: string[] = [];
    if (citation.contextType === ContextType.DOCUMENT_LIBRARY) {
      if (citation.sectionPath && citation.sectionPath.length > 0) {
        metadataParts.push(citation.sectionPath.join(' > '));
      }
      const page = citation.pageStart ?? citation.pageEnd;
      if (page !== undefined) {
        metadataParts.push(
          citation.pageStart !== undefined
            && citation.pageEnd !== undefined
            && citation.pageStart !== citation.pageEnd
            ? `pp. ${citation.pageStart}-${citation.pageEnd}`
            : `p. ${page}`,
        );
      }
    }
    return (
      <CitationContent
        citation={citation.citation}
        sourceLabel={citation.sourceLabel}
        metadata={metadataParts.length > 0 ? metadataParts.join(' · ') : undefined}
        onViewInDocument={canViewDocument(citation) ? () => handleCitationOpen(citation) : undefined}
      />
    );
  };

  const remainingCitationsHovercardContent = (
    <Stack spacing='md'>
      {remainingCitations.map((citation, index) => (
        <div key={`${citation.citation}-${citation.sourceLabel}`}>
          {renderCitationContent(citation)}
          {index < remainingCitations.length - 1 && <Divider color='gray.2' />}
        </div>
      ))}
    </Stack>
  );

  return (
    <Avatar.Group spacing='sm'>
      {displayedCitations.map((citation, index) => (
        <HoverCard
          key={`${citation.citation}-${citation.sourceLabel}`}
          shadow='md'
          withArrow
          position='bottom-start'
          withinPortal
        >
          <HoverCard.Target>
            <Avatar
              data-testid={`displayed-avatar-${index}`}
              color='dark.6'
              bg='gray.0'
              radius='xl'
              size='sm'
              style={{ cursor: 'pointer' }}
              onClick={citation.contextType === ContextType.PRIOR_CONVERSATION
                ? (event: React.MouseEvent<HTMLDivElement>) => handleConversationOpen(citation, event)
                : undefined}
            >
              {citation.contextType === ContextType.PRIOR_CONVERSATION
                ? <IconMessageCircle size={16} />
                : <IconFileDescription size={16} />}
            </Avatar>
          </HoverCard.Target>
          <HoverCard.Dropdown
            style={{
              maxWidth: '50%',
              maxHeight: '50%',
              overflow: 'auto',
            }}
          >
            {renderCitationContent(citation)}
          </HoverCard.Dropdown>
        </HoverCard>
      ))}
      {remainingCitationsCount > 0 && (
        <HoverCard
          shadow='md'
          withArrow
          position='bottom-start'
          withinPortal
        >
          <HoverCard.Target>
            <Avatar
              data-testid='remaining-citations-avatar'
              color='dark.6'
              bg='gray.0'
              radius='xl'
              size='sm'
              style={{ cursor: 'pointer' }}
            >
              +{remainingCitationsCount}
            </Avatar>
          </HoverCard.Target>
          <HoverCard.Dropdown
            style={{
              maxWidth: '50%',
              maxHeight: '50%',
              overflow: 'auto',
            }}
          >
            {remainingCitationsHovercardContent}
          </HoverCard.Dropdown>
        </HoverCard>
      )}
    </Avatar.Group>
  );
}
