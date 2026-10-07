import { UseCase } from '@/features/shared/types/use-case';

// The drawer's payload. Every figure here is selected under the same bucket
// expression and egress DAL the Value panel uses, so a drawer number always sums
// to the row that opened it.
export const USE_CASE_DETAIL_CHAT_LIMIT = 500;

export type UseCaseChatRow = {
  chatId: string;
  title: string | null;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  cost: number;
  artifacts: number;
  putToWork: number;
  createdAt: Date;
};

export type UseCasePersonRow = {
  userId: string;
  name: string | null;
  email: string | null;
  chats: number;
  cost: number;
  artifacts: number;
  putToWork: number;
};

export type UseCaseTeamRow = {
  userGroupId: string | null;
  label: string;
  chats: number;
  cost: number;
  artifacts: number;
  putToWork: number;
};

export type UseCaseEgressSignal = 'downloaded' | 'copied' | 'published';

export type UseCaseArtifactRow = {
  artifactId: string;
  name: string;
  chatId: string;
  signals: UseCaseEgressSignal[];
};

export type UseCaseWeekPoint = {
  weekStart: Date;
  cost: number;
  // Null when no chat spend at all landed in the week, so the sparkline can skip
  // the point rather than plot a 0% share that never happened.
  shareOfChatSpend: number | null;
};

export type UseCaseDetail = {
  useCase: UseCase;
  cost: number;
  artifacts: number;
  putToWork: number;
  totalChats: number;
  chats: UseCaseChatRow[];
  people: UseCasePersonRow[];
  teams: UseCaseTeamRow[];
  artifactList: UseCaseArtifactRow[];
  weekly: UseCaseWeekPoint[];
};

export type UseCaseTheme = {
  name: string;
  chats: number;
  cost: number;
};

export type UseCaseThemes = {
  themes: UseCaseTheme[];
  // The analyzed chats no shown theme claimed, summed by us rather than named by the
  // model, so the theme dollars always add up to the category's. Null when none are
  // left over.
  remainder: { chats: number; cost: number } | null;
  coveredChats: number;
  // How many chats the model was shown, which is not UseCaseDetail.totalChats: both
  // render in one drawer, and only that one counts the whole category.
  analyzedChats: number;
  // True when the category holds more chats than were analyzed, so the roll-up
  // describes the most expensive ones rather than all of them.
  truncated: boolean;
};

export type ChatTranscriptMessage = {
  role: string;
  content: string;
  createdAt: Date;
  usageSteps: { stepLabel: string; cost: number; tokens: number }[];
};
