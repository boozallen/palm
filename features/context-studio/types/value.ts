import { UseCase } from '@/features/shared/types/use-case';

// Result types for the Context Studio Value view. See
// docs/superpowers/specs/2026-09-02-value-tab-use-case-categorization-design.md
// for the authoritative metric definitions — the field comments here summarize
// them but the spec governs.
//
// The vocabulary itself lives in @/features/shared/types/use-case because the
// chat write path and the Library prompt forms need it too. Only the colours are
// here, because only this view paints anything.
export { UseCase };

// One accent for the eight substantive categories, neutral gray for
// Unclassified.
//
// This used to be one hue per category. Nine categories would need nine hues,
// and the previous three-hue palette already sat at tritan deltaE 4.0 on its
// adjacent pair — eight hues on the dark.7 (#14181F) surface will not survive a
// colour-vision check. Per-category hue was decorative even at three: the bars
// are direct-labeled, render in fixed order, and are never stacked or shown in a
// legend.
//
// So the direct labels in UseCaseSpendSection are now the ONLY identity channel.
// Removing them to save width does not degrade the panel, it breaks it.
//
// Literal hex rather than theme tokens because these are fed to a backgroundColor
// style value, which cannot read Mantine props.
export const USE_CASE_ACCENT_COLOR = '#3987e5';
export const USE_CASE_NEUTRAL_COLOR = '#6c6f75';

export const USE_CASE_COLORS: Record<UseCase, string> = {
  [UseCase.ProposalCapture]: USE_CASE_ACCENT_COLOR,
  [UseCase.PolicyCompliance]: USE_CASE_ACCENT_COLOR,
  [UseCase.ResearchAnalysis]: USE_CASE_ACCENT_COLOR,
  [UseCase.DataAnalytics]: USE_CASE_ACCENT_COLOR,
  [UseCase.Engineering]: USE_CASE_ACCENT_COLOR,
  [UseCase.WritingCommunication]: USE_CASE_ACCENT_COLOR,
  [UseCase.ProgramDelivery]: USE_CASE_ACCENT_COLOR,
  [UseCase.TrialTest]: USE_CASE_ACCENT_COLOR,
  // Never a hue: 'we could not read this chat' is not a category identity, and
  // giving it one invites the reader to treat it as a kind of work.
  [UseCase.Unclassified]: USE_CASE_NEUTRAL_COLOR,
};

// Which put-to-work signals fired for one artifact. Any true value means the
// artifact counts as put to work.
export type EgressSummary = {
  downloaded: boolean;
  copied: boolean;
  published: boolean;
};

export type MetricWithDelta = {
  value: number;
  previous: number;
};

export type UseCaseSpend = {
  useCase: UseCase;
  cost: number;
  artifacts: number;
  // Of those artifacts, how many were downloaded, copied or published. This is
  // what lets the panel answer "was any of this used?" rather than only "what
  // did it cost?".
  putToWork: number;
};

// The spend the bars deliberately do not categorize, named rather than dropped.
// Spend that silently leaves a total is how a dashboard loses an argument.
export type SpendRemainder = {
  platform: number;
  workflow: number;
  customAgent: number;
  unattributed: number;
};

export type TeamValue = {
  // Null for the synthetic 'no team' row.
  userGroupId: string | null;
  label: string;
  activePeople: number;
  members: number;
  artifacts: number;
  putToWork: number;
  cost: number;
};

export type ValueSummary = {
  provisionedPeople: number;
  activePeople: MetricWithDelta;
  returningPeople: MetricWithDelta;
  artifacts: MetricWithDelta;
  putToWork: MetricWithDelta;
  totalCost: number;
  // What the bars sum to: chat spend only. Lower than totalCost by the whole
  // remainder, which is why the footer exists.
  chatCost: number;
  remainder: SpendRemainder;
  // Shown as a parenthetical note, never added into totalCost. Present only so
  // the footer can reconcile against the Cost tab, which does count it.
  systemCost: number;
  // Null rather than 0 when nothing was put to work — a zero here would assert
  // a unit cost we cannot compute.
  costPerPutToWork: number | null;
  hoursInTool: number;
  hoursPerPersonPerWeek: number | null;
  byUseCase: UseCaseSpend[];
  byTeam: TeamValue[];
};
