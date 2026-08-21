export type AiAgent = {
  id: string;
  label: string;
  description: string;
  type: AiAgentType;
}

export type AgentPolicy = {
  id: string;
  aiAgentId: string;
  title: string;
  content: string;
  requirements: string;
}

export type SwearChecklistItem = {
  id: string;
  aiAgentId: string;
  category: string;
  item: string;
  sortOrder: number;
}

export enum AiAgentType {
  CERTA = 1,
  RADAR = 2,
  RCAST = 4,
  SWEAR = 5,
  PRISM = 6,
  MARGIN = 7,
  ODRAM = 8,
}

export const AiAgentLabels: Record<AiAgentType, string> = {
  [AiAgentType.CERTA]: 'Compliance Evaluation, Reporting, and Tracking Agent (CERTA)',
  [AiAgentType.RADAR]: 'Research Article Discovery and Reporting (RADAR)',
  [AiAgentType.RCAST]: 'Rate Card Analysis and Salary Tracking (RCAST)',
  [AiAgentType.SWEAR]: 'Search Warrant Evaluation, Analysis, and Review (SWEAR)',
  [AiAgentType.PRISM]: 'Proposal Requirements Inspection and Scoring Module (PRISM)',
  [AiAgentType.MARGIN]: 'Margin Analysis, Risk, and Growth Intelligence Navigator (MARGIN)',
  [AiAgentType.ODRAM]: 'Opportunity Delivery Risk Assessment Matrix (ODRAM)',
};
