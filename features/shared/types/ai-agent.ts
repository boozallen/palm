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

export enum AiAgentType {
  CERTA = 1,
  RADAR = 2,
}

export const AiAgentLabels: Record<AiAgentType, string> = {
  [AiAgentType.CERTA]: 'Compliance Evaluation, Reporting, and Tracking Agent (CERTA)',
  [AiAgentType.RADAR]: 'Research Article Discovery and Reporting (RADAR)',
};
