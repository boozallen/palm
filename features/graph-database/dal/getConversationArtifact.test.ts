import extractArtifactText from '@/features/chat/utils/artifacts/extractArtifactText';
import { CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS } from '@/features/graph-database/config/conversation-graph.config';
import getConversationArtifact from '@/features/graph-database/dal/getConversationArtifact';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    chatArtifact: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  },
}));
jest.mock('@/server/logger');
jest.mock('@/features/chat/utils/artifacts/extractArtifactText', () => ({
  __esModule: true,
  default: jest.fn(),
  canExtractArtifactText: jest.fn(
    (fileExtension: string) => ['.docx', '.pptx', '.xlsx'].includes(fileExtension.toLowerCase()),
  ),
}));

const extractText = extractArtifactText as jest.Mock;
const findArtifact = db.chatArtifact.findFirst as jest.Mock;
const countArtifacts = db.chatArtifact.count as jest.Mock;
const createdAt = new Date('2026-08-10T12:00:00.000Z');
const baseArtifact = {
  id: 'artifact-1',
  label: 'Analysis',
  fileExtension: '.txt',
  createdAt,
  sourceScript: null,
  sourceJson: null,
  content: 'Artifact text',
  chatMessageId: 'message-1',
  message: {
    chatId: 'chat-1',
    chat: { summary: 'Source conversation' },
  },
};

describe('getConversationArtifact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset, not clear: a queued once-value left unconsumed by one test would otherwise
    // be served to the next test's first query.
    findArtifact.mockReset();
    findArtifact.mockResolvedValue(baseArtifact);
    countArtifacts.mockResolvedValue(0);
    extractText.mockReset();
    extractText.mockResolvedValue(null);
  });

  it('enforces ownership in the artifact query and returns metadata', async () => {
    const result = await getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    });

    const query = findArtifact.mock.calls[0][0];
    // Pins the access wall: a foreign artifactId must be indistinguishable from a missing one.
    expect(JSON.stringify(query.where)).toContain(
      '"message":{"chat":{"userId":"user-1"}}',
    );
    expect(query.select).not.toHaveProperty('binaryContent');
    expect(result).toEqual(expect.objectContaining({
      id: 'artifact-1',
      label: 'Analysis',
      fileExtension: '.txt',
      createdAt,
      chatId: 'chat-1',
      chatTitle: 'Source conversation',
      messageId: 'message-1',
    }));
  });

  it.each([
    [
      'text before every fallback',
      { content: 'Text content', sourceScript: 'script', sourceJson: { fallback: true } },
      'text',
      'Text content',
    ],
    [
      'generation script when content is empty',
      { content: '', sourceScript: 'script', sourceJson: { fallback: true } },
      'generation-script',
      'script',
    ],
    [
      'serialized source JSON when content is empty and no script is present',
      { content: '', sourceScript: null, sourceJson: { paragraph: 'Hello' } },
      'docx-source-json',
      '{"paragraph":"Hello"}',
    ],
  ])('returns %s', async (_label, representation, contentType, content) => {
    findArtifact.mockResolvedValue({ ...baseArtifact, ...representation });

    await expect(getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    })).resolves.toEqual(expect.objectContaining({
      contentType,
      content,
      contentLength: content.length,
      cursor: 0,
      nextCursor: null,
    }));
  });

  it('returns empty text when no binary content exists', async () => {
    findArtifact.mockResolvedValue({
      ...baseArtifact,
      content: '',
      sourceScript: null,
      sourceJson: null,
    });

    await expect(getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    })).resolves.toEqual(expect.objectContaining({
      contentType: 'text',
      content: '',
      contentLength: 0,
      cursor: 0,
      nextCursor: null,
    }));
    expect(countArtifacts).toHaveBeenCalledWith({
      where: {
        id: 'artifact-1',
        binaryContent: { not: null },
        message: { chat: { userId: 'user-1' } },
      },
    });
  });

  it('returns the document text of an Office artifact ahead of its generation script', async () => {
    const officeArtifact = {
      ...baseArtifact,
      fileExtension: '.docx',
      content: '',
      sourceScript: 'which node && node -e "console.log(require(\'docx\'))"',
    };
    const bytes = new Uint8Array([80, 75, 3, 4]);
    findArtifact
      .mockResolvedValueOnce(officeArtifact)
      .mockResolvedValueOnce({ binaryContent: bytes });
    extractText.mockResolvedValue('Proposal for the VA fleet program');

    const result = await getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    });

    expect(result).toEqual(expect.objectContaining({
      contentType: 'extracted-text',
      content: 'Proposal for the VA fleet program',
      contentLength: 'Proposal for the VA fleet program'.length,
      cursor: 0,
      nextCursor: null,
    }));
    expect(extractText).toHaveBeenCalledWith('artifact-1', '.docx', bytes);
    expect(countArtifacts).not.toHaveBeenCalled();
    // The byte fetch carries the same access wall as the metadata query and selects only bytes.
    const byteQuery = findArtifact.mock.calls[1][0];
    expect(byteQuery.where).toEqual({
      id: 'artifact-1',
      message: { chat: { userId: 'user-1' } },
    });
    expect(byteQuery.select).toEqual({ binaryContent: true });
  });

  it('falls back to the generation script when an Office artifact cannot be read', async () => {
    findArtifact
      .mockResolvedValueOnce({ ...baseArtifact, fileExtension: '.xlsx', content: '', sourceScript: 'script' })
      .mockResolvedValueOnce({ binaryContent: new Uint8Array([1]) });
    extractText.mockResolvedValue(null);

    await expect(getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    })).resolves.toEqual(expect.objectContaining({
      contentType: 'generation-script',
      content: 'script',
    }));
  });

  it('reports a binary notice when an Office artifact cannot be read and has no other representation', async () => {
    findArtifact
      .mockResolvedValueOnce({ ...baseArtifact, fileExtension: '.pptx', content: '', sourceScript: null, sourceJson: null })
      .mockResolvedValueOnce({ binaryContent: new Uint8Array([1]) });
    extractText.mockResolvedValue(null);
    countArtifacts.mockResolvedValue(1);

    await expect(getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    })).resolves.toEqual(expect.objectContaining({ contentType: 'binary' }));
  });

  it('does not load bytes for file types that cannot be read as text', async () => {
    findArtifact.mockResolvedValue({ ...baseArtifact, content: '', sourceScript: 'script' });

    await getConversationArtifact({ userId: 'user-1', artifactId: 'artifact-1' });

    expect(findArtifact).toHaveBeenCalledTimes(1);
    expect(extractText).not.toHaveBeenCalled();
  });

  it('sanitizes errors from the byte fetch', async () => {
    const error = new Error('private database details');
    findArtifact
      .mockResolvedValueOnce({ ...baseArtifact, fileExtension: '.docx', content: '' })
      .mockRejectedValueOnce(error);

    await expect(getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    })).rejects.toThrow('Error fetching conversation artifact');
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching conversation artifact',
      { userId: 'user-1', artifactId: 'artifact-1', error },
    );
  });

  it('returns a metadata-only notice when binary content exists', async () => {
    findArtifact.mockResolvedValue({
      ...baseArtifact,
      content: '',
      sourceScript: null,
      sourceJson: null,
    });
    countArtifacts.mockResolvedValue(1);

    const result = await getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    });

    expect(result).toEqual(expect.objectContaining({
      contentType: 'binary',
      notice: 'Binary artifact; content not readable here. The user can download it from the source conversation.',
    }));
    expect(result).not.toHaveProperty('content');
    expect(result).not.toHaveProperty('cursor');
    expect(result).not.toHaveProperty('nextCursor');
  });

  it.each([
    ['first page', 0, CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS, CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS],
    [
      'middle page',
      CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS,
      CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS,
      CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS * 2,
    ],
    ['final page', CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS * 2, 5, null],
    ['cursor past the end', CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS * 3, 0, null],
  ])('paginates the %s', async (_label, cursor, pageLength, nextCursor) => {
    const content = 'x'.repeat(CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS * 2 + 5);
    findArtifact.mockResolvedValue({ ...baseArtifact, content });

    const result = await getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
      cursor,
    });

    expect(result).toEqual(expect.objectContaining({
      contentLength: content.length,
      cursor,
      nextCursor,
    }));
    expect('content' in result ? result.content : undefined).toHaveLength(pageLength);
    if (nextCursor === null) {
      expect(logger.info).not.toHaveBeenCalled();
    } else {
      expect(logger.info).toHaveBeenCalledWith(
        'Conversation artifact content paginated',
        {
          userId: 'user-1',
          artifactId: 'artifact-1',
          contentLength: content.length,
          cursor,
        },
      );
    }
  });

  it('keeps a surrogate pair intact when it straddles a page boundary', async () => {
    const content = `${'x'.repeat(CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS - 1)}😀tail`;
    findArtifact.mockResolvedValue({ ...baseArtifact, content });

    const firstPage = await getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    });
    expect(firstPage).toEqual(expect.objectContaining({
      content: `${'x'.repeat(CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS - 1)}😀`,
      nextCursor: CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS + 1,
    }));

    const secondPage = await getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
      cursor: 'nextCursor' in firstPage && firstPage.nextCursor !== null
        ? firstPage.nextCursor
        : undefined,
    });
    expect(secondPage).toEqual(expect.objectContaining({
      content: 'tail',
      cursor: CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS + 1,
      nextCursor: null,
    }));
    const firstContent = 'content' in firstPage ? firstPage.content : '';
    const secondContent = 'content' in secondPage ? secondPage.content : '';
    expect(firstContent + secondContent).toBe(content);
  });

  it('moves a cursor on a low surrogate back to the start of the pair', async () => {
    findArtifact.mockResolvedValue({ ...baseArtifact, content: 'A😀B' });

    await expect(getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
      cursor: 2,
    })).resolves.toEqual(expect.objectContaining({
      content: '😀B',
      cursor: 1,
      nextCursor: null,
    }));
  });

  it('returns the same not-found error for missing and foreign artifacts', async () => {
    findArtifact.mockResolvedValue(null);

    await expect(getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-foreign-or-missing',
    })).rejects.toThrow('Artifact not found');
  });

  it('logs database failures and throws a sanitized error', async () => {
    const error = new Error('private database details');
    findArtifact.mockRejectedValue(error);

    await expect(getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    })).rejects.toThrow('Error fetching conversation artifact');
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching conversation artifact',
      { userId: 'user-1', artifactId: 'artifact-1', error },
    );
  });

  it('sanitizes errors from the binary-content existence probe', async () => {
    const error = new Error('private database details');
    findArtifact.mockResolvedValue({
      ...baseArtifact,
      content: '',
      sourceScript: null,
      sourceJson: null,
    });
    countArtifacts.mockRejectedValue(error);

    await expect(getConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    })).rejects.toThrow('Error fetching conversation artifact');
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching conversation artifact',
      { userId: 'user-1', artifactId: 'artifact-1', error },
    );
  });
});
