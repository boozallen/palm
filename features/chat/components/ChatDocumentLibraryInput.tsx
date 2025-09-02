import { Box, Checkbox, Tooltip } from '@mantine/core';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';
import Loading from '@/features/shared/components/Loading';

type RouterQuery = {
  document_library: string | undefined;
};

export default function ChatDocumentLibraryInput() {
  const { documentLibraryEnabled, setDocumentLibraryEnabled } = useChat();
  const { data: documentUploadRequirements, isPending: documentUploadRequirementsLoading } = useGetDocumentUploadRequirements();

  const router = useRouter();
  const params = router.query as RouterQuery;

  useEffect(() => {
    if (params.document_library !== undefined) {
      setDocumentLibraryEnabled(params.document_library === 'true');
    }
  }, [params.document_library, setDocumentLibraryEnabled]);

  useEffect(() => {
    if (!documentUploadRequirementsLoading && !documentUploadRequirements?.configured) {
      setDocumentLibraryEnabled(false);
    }
  }, [documentUploadRequirementsLoading, documentUploadRequirements?.configured, setDocumentLibraryEnabled]);

  if (documentUploadRequirementsLoading) {
    return <Loading />;
  }

  const hasRequirements = documentUploadRequirements?.configured ?? false;

  return (
    <Tooltip
      label='Document Library requires configuration. Please contact your administrator.'
      disabled={hasRequirements}
      withArrow
      events={{ 'hover': true, 'focus': true, 'touch': true }}
    >
      <Box>
        <Checkbox
          data-testid='chat-document-library-input'
          label='Use Document Library'
          checked={documentLibraryEnabled}
          disabled={!hasRequirements}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setDocumentLibraryEnabled(event.currentTarget.checked);
          }}
        />
      </Box>
    </Tooltip>
  );
}
