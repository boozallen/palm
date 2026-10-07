export enum ComplianceStatus {
  YES = 'YES',
  NO = 'NO',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

export type ParsedRequirement = {
  category: string | null;
  requirement: string;
};

export type ComplianceResult = {
  id: string;
  jobId: string;
  category: string | null;
  requirement: string;
  complianceStatus: ComplianceStatus;
  reasoning: string;
  citations: string | null;
  sortOrder: number;
};

export type PrismJob = {
  id: string;
  aiAgentId: string;
  userId: string;
  status: string;
  requirementsFilename: string;
  proposalFilename: string;
  createdAt: Date;
};
