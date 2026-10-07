import { z } from 'zod';

export const policyComplianceSchema = z.object({
  url: z.string().url('Must start with \'http:\' or \'https:\''),
  policy: z.array(z.string().min(1)).min(1, 'You must select at least one policy'),
  model: z.string().uuid('You must select a model'),
  instructions: z.string(),
});

export type PolicyCompliance = z.infer<typeof policyComplianceSchema>;
export interface ProcessedHtml {
  text: string;
  html: string;
  tokenCount: number;
  metadata: {
    title?: string;
    description?: string;
    lastModified?: string;
    sections?: {
      type: string;
      content: string;
      tokenCount: number;
    }[];
  };
}

export enum ComplianceStatus {
  Yes = 'Yes',
  No = 'No',
  LeanYes = 'Lean Yes',
  LeanNo = 'Lean No',
  VeryUnclear = 'Very unclear'
}

export enum RequirementStatus {
  Met = 'Met',
  NotMet = 'Not met',
  PartiallyMet = 'Partially met',
}

export const complianceResultSchema = z.object({
  complianceStatus: z.nativeEnum(ComplianceStatus),
  requirements: z.array(z.object({
    requirement: z.string(),
    status: z.nativeEnum(RequirementStatus),
    evidence: z.array(z.object({
      text: z.string(),
      location: z.string(),
    })),
    explanation: z.string(),
  })),
  summary: z.string(),
  overallExplanation: z.string(),
  remediationSteps: z.array(z.string()).optional(),
});

export type ComplianceResult = z.infer<typeof complianceResultSchema>;

export type PolicyResults = Record<string, {
  isLoading: boolean;
  result?: ComplianceResult;
}>;

export const policyResultsSchema = z.record(
  z.string(),
  z.object({
    isLoading: z.boolean(),
    result: complianceResultSchema.optional(),
  })
);

export interface QueryEngine {
  addDocuments(documents: Document[], batchSize?: number): Promise<void>;
  runQuery(query: string): Promise<any>;
}

export interface PromptManager {
  getCompliancePrompt(): Promise<string>;
  getConsensusPrompt(
    input1: string,
    input2: string,
    input3: string,
  ): Promise<string>;
}

export type Policy = {
  id: string;
  title: string;
  content: string;
  requirements: string;
};

export type Section = {
  type: string;
  content: string;
  attributes: {
    [key: string]: string;
  };
} | null;

export interface Document {
  id?: string;
  text: string;
  metadata?: Record<string, any>;
} 
