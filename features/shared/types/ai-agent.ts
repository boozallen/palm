export type AiAgent = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export type AgentPolicy = {
  id: string;
  aiAgentId: string;
  title: string;
  content: string;
  requirements: string;
}

export enum AgentType {
  CERTA = 'Compliance Evaluation, Reporting, and Tracking Agent (CERTA)',
}
