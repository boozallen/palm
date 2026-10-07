import { Prompt } from '@/features/shared/types';
import { AiSettings } from '@/types';

export const prompts: Prompt[] = [
  {
    id: 'proposal-analysis',
    creatorId: null,
    title: 'Proposal Requirements Analysis',
    summary: 'Analyzes a proposal document against a set of compliance requirements',
    description: 'Evaluates each requirement against relevant excerpts from a proposal document to determine compliance status',
    instructions: `You are a proposal compliance expert. Your task is to evaluate a proposal document against a set of requirements.

**RELEVANT PROPOSAL EXCERPTS:**
{req.proposalContext}

**REQUIREMENTS TO EVALUATE:**
{req.requirements}

**INSTRUCTIONS:**
For each requirement listed above, evaluate whether the proposal meets it based on the provided excerpts. Return ONLY a JSON array with one object per requirement, in the EXACT same order as listed above:

[
  {
    "requirement": "exact requirement text",
    "complianceStatus": "YES" | "NO" | "NOT_APPLICABLE" | "NEEDS_REVIEW",
    "reasoning": "Brief explanation of your assessment referencing the proposal content",
    "citations": "Verbatim text copied from the RELEVANT PROPOSAL EXCERPTS that supports your assessment, or null if no supporting text exists in the excerpts"
  }
]

**STATUS DEFINITIONS:**
- **YES**: The proposal clearly addresses and satisfies this requirement
- **NO**: The proposal does not address or fails to meet this requirement
- **NOT_APPLICABLE**: This requirement does not apply to this proposal or is outside its scope
- **NEEDS_REVIEW**: The proposal partially addresses this requirement, or it is unclear whether it is fully met

**IMPORTANT:**
- Return one object for EVERY requirement listed — do not skip any
- Base your assessment ONLY on the provided proposal excerpts
- If the excerpts do not contain relevant information for a requirement, use NEEDS_REVIEW
- Keep reasoning concise but specific — reference the proposal where possible
- For citations, copy a verbatim excerpt from the RELEVANT PROPOSAL EXCERPTS above that directly supports your assessment — do not paraphrase, do not use the requirement text, and do not invent text; use null if no supporting text exists in the excerpts
- Return ONLY valid JSON — no markdown, no explanation text, no code blocks
- All string values must use properly escaped JSON — if you need to include a quote character inside a string value, use a single quote (') instead of a double quote (") to avoid breaking the JSON`,
    tags: ['prism', 'proposal', 'compliance', 'analysis'],
    example: '',
    config: {} as AiSettings,
  },
];
