import extractArtifactText from '@/features/chat/utils/artifacts/extractArtifactText';
import {
  ARTIFACT_PREVIEW_CHARS,
  ARTIFACT_SEARCH_PAGE_SIZE,
} from '@/features/graph-database/config/conversation-graph.config';
import findArtifacts from '@/features/graph-database/dal/findArtifacts';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    chatArtifact: {
      findMany: jest.fn(),
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

const findArtifactRows = db.chatArtifact.findMany as jest.Mock;
const extractText = extractArtifactText as jest.Mock;
const createdAt = new Date('2026-08-20T12:00:00.000Z');
const artifactRow = {
  id: 'artifact-1',
  label: 'Quarterly Plan',
  fileExtension: '.docx',
  createdAt,
  content: 'Quarterly plan content',
  sourceScript: null,
  sourceJson: null,
  chatMessageId: 'message-1',
  message: {
    chatId: 'chat-1',
    chat: { summary: 'Planning' },
  },
};
const binaryRow = {
  id: 'artifact-1',
  fileExtension: '.docx',
  binaryContent: new Uint8Array([80, 75, 3, 4]),
};

describe('findArtifacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset, not clear: a queued once-value left unconsumed by one test would otherwise
    // be served to the next test's first query.
    findArtifactRows.mockReset();
    findArtifactRows.mockResolvedValue([artifactRow]);
    extractText.mockReset();
    extractText.mockResolvedValue(null);
  });

  it('enforces ownership in the query and maps artifact metadata', async () => {
    const result = await findArtifacts({ userId: 'user-1' });
    const query = findArtifactRows.mock.calls[0][0];

    // Pins the access wall: artifacts owned by another user must never enter these results.
    expect(JSON.stringify(query.where)).toContain(
      '"message":{"chat":{"userId":"user-1"}}',
    );
    expect(query.select).toEqual(expect.objectContaining({
      content: true,
      sourceScript: true,
      sourceJson: true,
    }));
    expect(query.select).not.toHaveProperty('binaryContent');
    expect(result).toEqual([{
      id: 'artifact-1',
      label: 'Quarterly Plan',
      fileExtension: '.docx',
      createdAt,
      chatId: 'chat-1',
      chatTitle: 'Planning',
      messageId: 'message-1',
      contentPreview: 'Quarterly plan content',
    }]);
  });

  it.each([
    [
      'non-empty content before every fallback',
      { content: 'Text content', sourceScript: 'script', sourceJson: { fallback: true } },
      'Text content',
    ],
    [
      'generation script when content is empty and no document text can be extracted',
      { content: '', sourceScript: 'script', sourceJson: { fallback: true } },
      'script',
    ],
    [
      'serialized source JSON when content is empty and no script is present',
      { content: '', sourceScript: null, sourceJson: { paragraph: 'Hello' } },
      '{"paragraph":"Hello"}',
    ],
    [
      'empty preview for binary artifacts',
      { content: '', sourceScript: null, sourceJson: null },
      '',
    ],
  ])('previews %s', async (_label, representation, contentPreview) => {
    findArtifactRows
      .mockResolvedValueOnce([{ ...artifactRow, ...representation }])
      .mockResolvedValueOnce([binaryRow]);

    await expect(findArtifacts({ userId: 'user-1' })).resolves.toEqual([
      expect.objectContaining({ contentPreview }),
    ]);
  });

  it('previews the document text of an Office artifact ahead of its generation script', async () => {
    findArtifactRows
      .mockResolvedValueOnce([{ ...artifactRow, content: '', sourceScript: 'which node && node -e' }])
      .mockResolvedValueOnce([binaryRow]);
    extractText.mockResolvedValue('Proposal for the VA fleet program');

    const [result] = await findArtifacts({ userId: 'user-1' });

    expect(result.contentPreview).toBe('Proposal for the VA fleet program');
    expect(extractText).toHaveBeenCalledWith('artifact-1', '.docx', binaryRow.binaryContent);
    // The byte fetch carries the same access wall as the listing, and only it selects bytes.
    const binaryQuery = findArtifactRows.mock.calls[1][0];
    expect(binaryQuery.where).toEqual({
      id: { in: ['artifact-1'] },
      message: { chat: { userId: 'user-1' } },
    });
    expect(binaryQuery.select).toEqual(expect.objectContaining({ binaryContent: true }));
  });

  it('loads bytes only for empty-content artifacts whose file type can be read', async () => {
    findArtifactRows
      .mockResolvedValueOnce([
        artifactRow,
        { ...artifactRow, id: 'artifact-2', fileExtension: '.mp4', content: '' },
        { ...artifactRow, id: 'artifact-3', fileExtension: '.xlsx', content: '' },
      ])
      .mockResolvedValueOnce([{ ...binaryRow, id: 'artifact-3', fileExtension: '.xlsx' }]);
    extractText.mockResolvedValue('Sheet 1');

    const results = await findArtifacts({ userId: 'user-1' });

    expect(findArtifactRows).toHaveBeenCalledTimes(2);
    expect(findArtifactRows.mock.calls[1][0].where.id).toEqual({ in: ['artifact-3'] });
    expect(results.map((r) => r.contentPreview)).toEqual(['Quarterly plan content', '', 'Sheet 1']);
  });

  it('skips the byte fetch entirely when no artifact on the page needs it', async () => {
    findArtifactRows.mockResolvedValueOnce([
      artifactRow,
      { ...artifactRow, id: 'artifact-2', fileExtension: '.html', content: '<p>Hi</p>' },
    ]);

    await findArtifacts({ userId: 'user-1' });

    expect(findArtifactRows).toHaveBeenCalledTimes(1);
    expect(extractText).not.toHaveBeenCalled();
  });

  it('caps the preview at the configured size', async () => {
    const content = 'x'.repeat(ARTIFACT_PREVIEW_CHARS + 1);
    findArtifactRows.mockResolvedValue([{ ...artifactRow, content }]);

    const [result] = await findArtifacts({ userId: 'user-1' });

    expect(result.contentPreview).toBe('x'.repeat(ARTIFACT_PREVIEW_CHARS));
  });

  it('keeps a surrogate pair intact when it straddles the preview boundary', async () => {
    const content = `${'x'.repeat(ARTIFACT_PREVIEW_CHARS - 1)}😀tail`;
    findArtifactRows.mockResolvedValue([{ ...artifactRow, content }]);

    const [result] = await findArtifacts({ userId: 'user-1' });

    expect(result.contentPreview).toBe(`${'x'.repeat(ARTIFACT_PREVIEW_CHARS - 1)}😀`);
  });

  it('filters labels case-insensitively', async () => {
    await findArtifacts({ userId: 'user-1', label: ' quarterly ' });

    expect(findArtifactRows).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        label: { contains: 'quarterly', mode: 'insensitive' },
      }),
    }));
  });

  it('matches both stored forms, in any case, when the file extension has no leading dot', async () => {
    await findArtifacts({ userId: 'user-1', fileExtension: 'DOCX' });

    expect(findArtifactRows).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        fileExtension: { in: ['DOCX', '.DOCX'], mode: 'insensitive' },
      }),
    }));
  });

  it('matches the stored form, in any case, when the file extension has a leading dot', async () => {
    await findArtifacts({ userId: 'user-1', fileExtension: '.Docx' });

    expect(findArtifactRows).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        fileExtension: { equals: '.Docx', mode: 'insensitive' },
      }),
    }));
  });

  it('filters by creation date', async () => {
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-08-29T00:00:00.000Z').getTime());

    await findArtifacts({ userId: 'user-1', sinceDays: 7 });

    expect(findArtifactRows).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        createdAt: { gte: new Date('2026-08-22T00:00:00.000Z') },
      }),
    }));
    nowSpy.mockRestore();
  });

  it('lists recent artifacts without optional filters and uses stable pagination', async () => {
    await findArtifacts({ userId: 'user-1', cursor: 40 });

    expect(findArtifactRows).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        message: { chat: { userId: 'user-1' } },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: ARTIFACT_SEARCH_PAGE_SIZE,
      skip: 40,
    }));
  });

  it('logs database failures and throws a sanitized error', async () => {
    const error = new Error('private database details');
    findArtifactRows.mockRejectedValue(error);

    await expect(findArtifacts({ userId: 'user-1' }))
      .rejects.toThrow('Error finding artifacts');
    expect(logger.error).toHaveBeenCalledWith(
      'Error finding artifacts',
      { userId: 'user-1', error },
    );
  });
});
