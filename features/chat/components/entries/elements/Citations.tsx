import { Avatar, HoverCard, Stack, Text, Title, Divider, Button, Group } from '@mantine/core';
import { IconFileDescription, IconEye } from '@tabler/icons-react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import { Citation } from '@/features/chat/types/message';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';

type CitationsProps = Readonly<{
  citations: Citation[];
}>;

const CitationContent = ({ citation, sourceLabel, onViewInDocument }: { citation: string; sourceLabel: string; onViewInDocument?: () => void }) => {
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
      <Text size='sm' color='gray.7'>
        {citation}
      </Text>
    </Stack>
  );
};

export default function Citations({ citations }: CitationsProps) {
  const { setHighlightedCitation, setSourcesSidebarExpanded } = useChat();
  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const { data: userDocuments } = useGetDocuments({ documentUploadProviderId });

  const MAX_DISPLAYED_CITATION_ICONS = 3;
  const displayedCitations = citations.slice(0, MAX_DISPLAYED_CITATION_ICONS);

  const remainingCitations = citations.slice(MAX_DISPLAYED_CITATION_ICONS);
  const remainingCitationsCount = remainingCitations.length;

  // Helper function to check if a document has text content
  const documentHasText = (citation: Citation): boolean => {
    if (citation.contextType !== 'DOCUMENT_LIBRARY') {
      return false;
    }
    const document = userDocuments?.documents?.find(doc => doc.id === citation.documentId);
    return !!document?.text;
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
        });
      }, 50);
    }
  };

  const remainingCitationsHovercardContent = (
    <Stack spacing='md'>
      {remainingCitations.map((citation, index) => (
        <div key={`${citation.citation}-${citation.sourceLabel}`}>
          <CitationContent
            citation={citation.citation}
            sourceLabel={citation.sourceLabel}
            onViewInDocument={documentHasText(citation) ? () => handleCitationOpen(citation) : undefined}
          />
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
            >
              <IconFileDescription />
            </Avatar>
          </HoverCard.Target>
          <HoverCard.Dropdown
            style={{
              maxWidth: '50%',
              maxHeight: '50%',
              overflow: 'auto',
            }}
          >
            <CitationContent
              citation={citation.citation}
              sourceLabel={citation.sourceLabel}
              onViewInDocument={documentHasText(citation) ? () => handleCitationOpen(citation) : undefined}
            />
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
