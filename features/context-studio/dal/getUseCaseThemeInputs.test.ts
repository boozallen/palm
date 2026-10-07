import getChatRequestExcerpts from '@/features/context-studio/dal/getChatRequestExcerpts';
import getUseCaseThemeInputs from '@/features/context-studio/dal/getUseCaseThemeInputs';
import {
  queryUseCaseArtifacts,
  queryUseCaseChats,
} from '@/features/context-studio/dal/useCaseChatQueries';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';

jest.mock('@/features/context-studio/dal/getChatRequestExcerpts');
jest.mock('@/features/context-studio/dal/useCaseChatQueries');
jest.mock('@/server/logger');

const chats = queryUseCaseChats as jest.Mock;
const artifacts = queryUseCaseArtifacts as jest.Mock;
const excerpts = getChatRequestExcerpts as jest.Mock;

const chatRows = [
  { chat_id: 'chat-1', title: 'Competitor Landscape', owner_user_id: 'user-1', owner_name: 'Dana', owner_email: 'dana@x.test', cost: 38, created_at: new Date('2026-09-01') },
  { chat_id: 'chat-2', title: null, owner_user_id: 'user-2', owner_name: 'Marcus', owner_email: 'marcus@x.test', cost: null, created_at: new Date('2026-09-02') },
];

const artifactRows = [
  { artifact_id: 'art-1', name: 'matrix.xlsx', chat_id: 'chat-1', owner_user_id: 'user-1', user_group_id: 'group-1', group_label: 'Capture' },
  { artifact_id: 'art-2', name: 'notes.md', chat_id: 'chat-1', owner_user_id: 'user-1', user_group_id: 'group-1', group_label: 'Capture' },
];

describe('getUseCaseThemeInputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chats.mockResolvedValue(chatRows);
    artifacts.mockResolvedValue(artifactRows);
    excerpts.mockResolvedValue(new Map([['chat-1', ['Draft the Harbor Authority recompete response']]]));
  });

  it('describes each chat with its work product names and what the person wrote', async () => {
    const result = await getUseCaseThemeInputs(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(result).toEqual([
      {
        chatId: 'chat-1',
        title: 'Competitor Landscape',
        artifactNames: ['matrix.xlsx', 'notes.md'],
        excerpts: ['Draft the Harbor Authority recompete response'],
        cost: 38,
      },
      {
        chatId: 'chat-2',
        title: null,
        artifactNames: [],
        excerpts: [],
        cost: 0,
      },
    ]);
  });

  // The roll-up and the drawer's figures have to describe the same work, which they
  // do by resolving the category through one shared pair of queries.
  it('resolves the category with the same scope the detail view uses', async () => {
    await getUseCaseThemeInputs(UseCase.ResearchAnalysis, TimeRange.Year, 'group-1', 'user-9', false);

    const expected = {
      useCase: UseCase.ResearchAnalysis,
      timeRange: TimeRange.Year,
      userGroupId: 'group-1',
      userId: 'user-9',
      excludeAdmins: false,
    };
    expect(chats).toHaveBeenCalledWith(expected);
    expect(artifacts).toHaveBeenCalledWith(expected);
  });

  it('reads the conversations of exactly the chats it summarizes', async () => {
    await getUseCaseThemeInputs(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(excerpts).toHaveBeenCalledWith(['chat-1', 'chat-2']);
  });

  // The roll-up only needs chats, work product names and excerpts, so pulling the
  // spend, weekly, total and egress reads it never looks at was wasted work.
  it('does not read the spend or usage signals the displayed figures need', async () => {
    await getUseCaseThemeInputs(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(chats).toHaveBeenCalledTimes(1);
    expect(artifacts).toHaveBeenCalledTimes(1);
    expect(excerpts).toHaveBeenCalledTimes(1);
  });

  it('throws a sanitized error when a query fails', async () => {
    chats.mockRejectedValue(new Error('connection lost'));

    await expect(getUseCaseThemeInputs(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all'))
      .rejects.toThrow('Failed to fetch use case theme inputs');
  });
});
