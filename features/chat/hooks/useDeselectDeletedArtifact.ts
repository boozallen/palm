import { useEffect } from 'react';
import { Entries } from '@/features/chat/types/entry';
import { isMessageEntry } from '@/features/chat/utils/chatHelperFunctions';

interface ArtifactInfo {
  id: string;
  [key: string]: any;
}

/**
 * Hook to close an artifact container when the artifact is no longer 
 * present in the messages history
 * 
 * @param messages - Array of message entries
 * @param selectedArtifact - Currently selected artifact
 * @param onDeselectArtifact - Callback function to close the artifact
 */
export default function useDeselectDeletedArtifact(
  messages: Entries,
  selectedArtifact: ArtifactInfo | null,
  onDeselectArtifact: () => void
) {
  useEffect(() => {
    if (selectedArtifact) {
      const artifactExistsInMessages = messages.some((entry) =>
        isMessageEntry(entry) &&
        entry.artifacts?.some((artifact) => artifact.id === selectedArtifact.id)
      );
      
      if (!artifactExistsInMessages) {
        onDeselectArtifact();
      }
    }
  }, [messages, selectedArtifact, onDeselectArtifact]);
}
