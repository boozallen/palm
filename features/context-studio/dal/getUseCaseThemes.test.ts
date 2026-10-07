import getUseCaseThemes, { buildThemeCacheKey } from '@/features/context-studio/dal/getUseCaseThemes';
import summarizeUseCaseThemes, { ThemeInputChat } from '@/features/context-studio/services/summarizeUseCaseThemes';
import { AIFactory } from '@/features/ai-provider';
import { UseCase } from '@/features/shared/types/use-case';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    useCaseThemeSummary: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  },
}));
// The prompt version is read through a getter so a test can bump it, which is the
// only way to observe that a reworded prompt misses the cache.
const mockPromptVersion = { current: 1 };
jest.mock('@/features/context-studio/services/summarizeUseCaseThemes', () => ({
  __esModule: true,
  default: jest.fn(),
  get THEME_PROMPT_VERSION() {
    return mockPromptVersion.current;
  },
}));
jest.mock('@/features/ai-provider', () => ({ AIFactory: jest.fn() }));
jest.mock('@/server/logger');

const findUnique = db.useCaseThemeSummary.findUnique as jest.Mock;
const create = db.useCaseThemeSummary.create as jest.Mock;
const deleteMany = db.useCaseThemeSummary.deleteMany as jest.Mock;
const summarize = summarizeUseCaseThemes as jest.Mock;

const chats: ThemeInputChat[] = [
  { chatId: 'chat-1', title: 'A', artifactNames: [], excerpts: [], cost: 10 },
  { chatId: 'chat-2', title: 'B', artifactNames: [], excerpts: [], cost: 20 },
];
const summary = { themes: [{ name: 'Theme', chats: 2, cost: 30 }], remainder: null, coveredChats: 2, analyzedChats: 2, truncated: false };

describe('buildThemeCacheKey', () => {
  it('is stable regardless of the order the chats arrive in', () => {
    expect(buildThemeCacheKey(UseCase.Engineering, [...chats].reverse()))
      .toBe(buildThemeCacheKey(UseCase.Engineering, chats));
  });

  it('changes when a chat joins the set', () => {
    expect(buildThemeCacheKey(UseCase.Engineering, [chats[0]]))
      .not.toBe(buildThemeCacheKey(UseCase.Engineering, chats));
  });

  it('changes between categories over the same chats', () => {
    expect(buildThemeCacheKey(UseCase.Engineering, chats))
      .not.toBe(buildThemeCacheKey(UseCase.DataAnalytics, chats));
  });

  // A theme's dollars are summed from these costs, so the same chats under a
  // different time range must not be served the other range's figures.
  it('changes when the same chats carry a different spend', () => {
    const rescaled = chats.map((chat) => ({ ...chat, cost: chat.cost * 2 }));

    expect(buildThemeCacheKey(UseCase.Engineering, rescaled))
      .not.toBe(buildThemeCacheKey(UseCase.Engineering, chats));
  });

  it('changes when a chat gains a work product, which changes the prompt', () => {
    const withArtifact = [{ ...chats[0], artifactNames: ['brief.docx'] }, chats[1]];

    expect(buildThemeCacheKey(UseCase.Engineering, withArtifact))
      .not.toBe(buildThemeCacheKey(UseCase.Engineering, chats));
  });

  // The pursuit a theme names comes out of these, so a chat whose conversation was
  // read differently cannot be served the themes from before it was read.
  it('changes when a chat gains an excerpt from its conversation', () => {
    const withExcerpt = [{ ...chats[0], excerpts: ['This is for the Cascade County RFI'] }, chats[1]];

    expect(buildThemeCacheKey(UseCase.Engineering, withExcerpt))
      .not.toBe(buildThemeCacheKey(UseCase.Engineering, chats));
  });

  it('changes when a chat is retitled, which changes the prompt', () => {
    const retitled = [{ ...chats[0], title: 'A different question' }, chats[1]];

    expect(buildThemeCacheKey(UseCase.Engineering, retitled))
      .not.toBe(buildThemeCacheKey(UseCase.Engineering, chats));
  });

  it('changes when the prompt version is bumped, so a reworded prompt misses the cache', () => {
    const keyAtCurrentVersion = buildThemeCacheKey(UseCase.Engineering, chats);
    mockPromptVersion.current += 1;
    const keyAtNextVersion = buildThemeCacheKey(UseCase.Engineering, chats);
    mockPromptVersion.current -= 1;

    expect(keyAtNextVersion).not.toBe(keyAtCurrentVersion);
  });
});

describe('getUseCaseThemes', () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    deleteMany.mockReset();
    summarize.mockReset();
    (AIFactory as unknown as jest.Mock).mockClear();
  });

  // The model call behind a roll-up must be attributed to the group the viewer
  // was scoped to, not left to land as unattributed spend.
  it('attributes the model call to the viewer-selected group', async () => {
    findUnique.mockResolvedValue(null);
    summarize.mockResolvedValue(summary);

    await getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1', 'group-1');

    expect(AIFactory).toHaveBeenCalledWith({ userId: 'viewer-1', userGroupId: 'group-1' });
  });

  it('leaves usage unattributed when no group was selected', async () => {
    findUnique.mockResolvedValue(null);
    summarize.mockResolvedValue(summary);

    await getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1');

    expect(AIFactory).toHaveBeenCalledWith({ userId: 'viewer-1', userGroupId: undefined });
  });

  it('serves a cached roll-up without calling the model', async () => {
    findUnique.mockResolvedValue({ themes: summary });

    const result = await getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1');

    expect(result).toEqual(summary);
    expect(summarize).not.toHaveBeenCalled();
  });

  it('computes and stores a roll-up on a cache miss', async () => {
    findUnique.mockResolvedValue(null);
    summarize.mockResolvedValue(summary);

    const result = await getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1');

    expect(result).toEqual(summary);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ useCase: UseCase.Engineering, chatCount: 2 }),
    }));
  });

  it('stores nothing when the model call fails', async () => {
    findUnique.mockResolvedValue(null);
    summarize.mockResolvedValue(null);

    await expect(getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1')).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('returns null without touching the cache when there are no chats', async () => {
    await expect(getUseCaseThemes(UseCase.Engineering, [], 'viewer-1')).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns the roll-up even when pruning old rows fails', async () => {
    findUnique.mockResolvedValue(null);
    summarize.mockResolvedValue(summary);
    deleteMany.mockRejectedValue(new Error('lock timeout'));

    await expect(getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1')).resolves.toEqual(summary);
  });

  it('recomputes when cached data has the wrong shape', async () => {
    const malformedData = { themes: [{ name: 'Theme', chats: 'two', cost: 30 }], remainder: null, coveredChats: 2, analyzedChats: 2, truncated: false };
    findUnique.mockResolvedValue({ themes: malformedData });
    summarize.mockResolvedValue(summary);

    const result = await getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1');

    expect(result).toEqual(summary);
    expect(summarize).toHaveBeenCalled();
  });

  it('serves a cached roll-up that accounts for leftover chats', async () => {
    const withRemainder = { ...summary, remainder: { chats: 4, cost: 12.5 } };
    findUnique.mockResolvedValue({ themes: withRemainder });

    await expect(getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1')).resolves.toEqual(withRemainder);
  });

  // Rows written before the block accounted for leftover chats would render a roll-up
  // whose dollars do not add up to the category total.
  it('recomputes a cached row that predates the leftover figure', async () => {
    const { remainder: _remainder, ...withoutRemainder } = summary;
    findUnique.mockResolvedValue({ themes: withoutRemainder });
    summarize.mockResolvedValue(summary);

    await expect(getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1')).resolves.toEqual(summary);
    expect(summarize).toHaveBeenCalled();
  });

  it('rejects a cached leftover figure that is not a number', async () => {
    findUnique.mockResolvedValue({ themes: { ...summary, remainder: { chats: 'four', cost: 12.5 } } });
    summarize.mockResolvedValue(summary);

    await expect(getUseCaseThemes(UseCase.Engineering, chats, 'viewer-1')).resolves.toEqual(summary);
    expect(summarize).toHaveBeenCalled();
  });
});
