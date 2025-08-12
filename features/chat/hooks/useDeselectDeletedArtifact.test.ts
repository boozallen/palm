import { renderHook } from '@testing-library/react';
import useDeselectDeletedArtifact from './useDeselectDeletedArtifact';
import { Entries, MessageEntry, EntryType } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';

describe('useDeselectDeletedArtifact', () => {
  const onDeselectArtifactMock = jest.fn();

  const artifactId = 'artifact-1';
  const selectedArtifact = { id: artifactId };

  const createMessageEntry = (artifacts: any[] = []): MessageEntry => ({
    id: 'message-1',
    chatId: 'chat-1',
    type: EntryType.Message,
    role: MessageRole.User,
    content: 'Hello',
    createdAt: new Date(),
    artifacts,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not call onDeselectArtifact if the artifact exists in messages', () => {
    const messages: Entries = [
      createMessageEntry([{ id: artifactId }]),
    ];

    renderHook(() => useDeselectDeletedArtifact(messages, selectedArtifact, onDeselectArtifactMock));

    expect(onDeselectArtifactMock).not.toHaveBeenCalled();
  });

  it('should call onDeselectArtifact if the artifact does not exist in messages', () => {
    const messages: Entries = [
      createMessageEntry([{ id: 'artifact-2' }]),
    ];

    renderHook(() => useDeselectDeletedArtifact(messages, selectedArtifact, onDeselectArtifactMock));

    expect(onDeselectArtifactMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onDeselectArtifact if selectedArtifact is null', () => {
    const messages: Entries = [
      createMessageEntry([{ id: artifactId }]),
    ];

    renderHook(() => useDeselectDeletedArtifact(messages, null, onDeselectArtifactMock));

    expect(onDeselectArtifactMock).not.toHaveBeenCalled();
  });

  it('should not call onDeselectArtifact if messages are empty', () => {
    const messages: Entries = [];

    renderHook(() => useDeselectDeletedArtifact(messages, selectedArtifact, onDeselectArtifactMock));

    expect(onDeselectArtifactMock).toHaveBeenCalledTimes(1);
  });
});
