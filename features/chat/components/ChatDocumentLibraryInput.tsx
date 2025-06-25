import { Checkbox } from '@mantine/core';

import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { features } from '@/features/shared/types';

export default function ChatDocumentLibraryInput() {
  const { data: featureDocumentLibrary } = useGetFeatureFlag({ feature: features.DOCUMENT_LIBRARY });
  if (!featureDocumentLibrary?.isFeatureOn) {
    return null;
  }
  
  return (
    <Checkbox
      data-testid='chat-document-library-input'
      label='Use Document Library'
    />
  );
}
