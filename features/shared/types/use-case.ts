// The closed category vocabulary for "what was this person doing". Lives in
// shared/ because two features need it: the chat write path that assigns a
// category (features/chat/system-ai) and the Context Studio Value view that
// reports on it.
//
// Closed deliberately. An emergent vocabulary with an admin promote/merge
// workflow was considered and rejected — breadth of the preset list is the
// defence against gaps, not a workflow.
export enum UseCase {
  ProposalCapture = 'proposalCapture',
  PolicyCompliance = 'policyCompliance',
  ResearchAnalysis = 'researchAnalysis',
  DataAnalytics = 'dataAnalytics',
  Engineering = 'engineering',
  WritingCommunication = 'writingCommunication',
  ProgramDelivery = 'programDelivery',
  TrialTest = 'trialTest',
  Unclassified = 'unclassified',
}

export const USE_CASE_LABELS: Record<UseCase, string> = {
  [UseCase.ProposalCapture]: 'Capture & proposal',
  [UseCase.PolicyCompliance]: 'Policy, compliance & risk',
  [UseCase.ResearchAnalysis]: 'Research & analysis',
  [UseCase.DataAnalytics]: 'Data & analytics',
  [UseCase.Engineering]: 'Engineering',
  [UseCase.WritingCommunication]: 'Writing & communication',
  [UseCase.ProgramDelivery]: 'Program & delivery',
  [UseCase.TrialTest]: 'Trial & test',
  [UseCase.Unclassified]: 'Unclassified',
};

// Fixed render order. Never sort by value: a filter that empties one category
// must not move the others, or two screenshots of the same panel stop being
// comparable. Unclassified is last because it is the absence of a finding, not a
// finding.
export const USE_CASE_ORDER: UseCase[] = [
  UseCase.ProposalCapture,
  UseCase.PolicyCompliance,
  UseCase.ResearchAnalysis,
  UseCase.DataAnalytics,
  UseCase.Engineering,
  UseCase.WritingCommunication,
  UseCase.ProgramDelivery,
  UseCase.TrialTest,
  UseCase.Unclassified,
];

// What the chat write path (features/chat/system-ai) asks the model to choose
// between. Kept distinct from USE_CASE_LABELS, which is display copy for the
// Value tab's UI ('Capture & proposal') rather than prompt vocabulary — the two
// evolve for different reasons. Unclassified is omitted: it is the fallback for
// an unparseable or unrecognized response, never a choice offered to the model.
export const USE_CASE_PROMPT_LABELS: Record<Exclude<UseCase, UseCase.Unclassified>, string> = {
  [UseCase.ProposalCapture]: 'Proposal Capture',
  [UseCase.PolicyCompliance]: 'Policy Compliance',
  [UseCase.ResearchAnalysis]: 'Research Analysis',
  [UseCase.DataAnalytics]: 'Data Analytics',
  [UseCase.Engineering]: 'Engineering',
  [UseCase.WritingCommunication]: 'Writing Communication',
  [UseCase.ProgramDelivery]: 'Program Delivery',
  [UseCase.TrialTest]: 'Trial Test',
};

const USE_CASE_VALUES = new Set<string>(Object.values(UseCase));

// Chat.useCase is a String?, so an unrecognized value can reach the reader.
// Everything that turns that column into a UseCase goes through this guard
// rather than casting.
export function isUseCase(value: unknown): value is UseCase {
  return typeof value === 'string' && USE_CASE_VALUES.has(value);
}
