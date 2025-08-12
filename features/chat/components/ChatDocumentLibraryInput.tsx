import { Box, Checkbox, Tooltip } from '@mantine/core';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetHasOpenAiModel from '@/features/shared/api/get-has-openai-model';
import Loading from '@/features/shared/components/Loading';

type RouterQuery = {
  document_library: string | undefined;
}

export default function ChatDocumentLibraryInput() {
  const { documentLibraryEnabled, setDocumentLibraryEnabled } = useChat();
  const { data: hasOpenAiModel, isPending: hasOpenAiModelIsLoading } = useGetHasOpenAiModel();

  const router = useRouter();
  const params = router.query as RouterQuery;

  useEffect(() => {
    if (params.document_library !== undefined) {
      setDocumentLibraryEnabled(params.document_library === 'true');
    }
  }, [params.document_library, setDocumentLibraryEnabled]);

  useEffect(() => {
    if (!hasOpenAiModelIsLoading && !hasOpenAiModel) {
      setDocumentLibraryEnabled(false);
    }
  }, [hasOpenAiModelIsLoading, hasOpenAiModel, setDocumentLibraryEnabled]);

  if (hasOpenAiModelIsLoading) {
    return <Loading />;
  }

  return (
    <Tooltip
      label='This functionality requires access to an OpenAI model. Please reach out to your group lead or manager to get access.'
      disabled={hasOpenAiModel}
      withArrow
      // Explicitly set events to prevent tooltip from showing whenever disabled prop changes value
      events={{ 'hover': true, 'focus': true, 'touch': true }}
    >
      <Box>
        <Checkbox
          data-testid='chat-document-library-input'
          label='Use Document Library'
          checked={documentLibraryEnabled}
          disabled={!hasOpenAiModel}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setDocumentLibraryEnabled(event.currentTarget.checked);
          }}
        />
      </Box>
    </Tooltip>
  );
}
