import { Prompt } from '@/features/shared/types';
import { AiSettings } from '@/types';

export const prompts: Prompt[] = [
  {
    id: 'warrant-analysis',
    creatorId: null,
    title: 'Search Warrant Analysis',
    summary: 'Analyzes search warrants for completeness, validity, and potential issues',
    description: 'Performs comprehensive analysis of search warrant documents to identify legal requirements, potential issues, and areas requiring attention',
    instructions: `You are an experienced law enforcement compliance expert with extensive expertise in legal compliance and search warrant review. Your task is to conduct a detailed evaluation of the provided search warrant document against established legal requirements.

**SEARCH WARRANT DOCUMENT:**
{req.documentContent}

**ANALYSIS INSTRUCTIONS:**

Carefully read the entire search warrant document. For each requirement in the checklist below, you must:
1. Search the document for specific text, phrases, or sections that address the requirement
2. Quote or paraphrase the relevant passages you find (or note their absence)
3. Assess whether the requirement is met based on the evidence in the document
4. Assign a confidence level based on how clearly the document addresses the requirement

**CHECKLIST REQUIREMENTS:**
{req.checklistItems}

**OUTPUT FORMAT:**

You MUST return your analysis as a JSON array. Do not include any text before or after the JSON. The response must be valid JSON that can be parsed.

**CRITICAL: You MUST include an entry for EVERY SINGLE checklist item above. Do NOT skip or omit any items, even if they are N/A. The number of items in your JSON response MUST match the number of checklist items provided. If you skip items, your response will be rejected.**

Return ONLY a JSON array with the following structure:
[
  {
    "category": "Use the EXACT category name from the checklist including the Roman numeral prefix (e.g., 'I. Preliminary Information', 'II. Probable Cause')",
    "requirement": "The exact checklist item/question text",
    "status": "PASS" | "FAIL" | "PARTIAL" | "N/A",
    "confidence": "HIGH" | "MEDIUM" | "LOW",
    "evidence": "Document evidence and reasoning"
  }
]

**STATUS DEFINITIONS:**
- **PASS**: The document clearly satisfies this requirement with specific details
- **FAIL**: The document does not address this requirement or is missing required information that SHOULD be present
- **PARTIAL**: The document partially addresses the requirement but lacks complete information
- **N/A**: This requirement does not apply to this warrant OR cannot be evaluated from the document

**CRITICAL - HANDLING CONDITIONAL QUESTIONS:**
Many checklist items are CONDITIONAL questions that determine whether a set of requirements applies. These typically start with phrases like:
- "Are you requesting..." / "Are you seeking..."
- "Is it a..." / "Is this a..."
- "Is your probable cause based on..."
- "If the informant is..."

For these conditional questions:
- If the answer is "NO" (the warrant does NOT involve that scenario), mark as **N/A** - NOT FAIL
- Only mark as FAIL if the scenario DOES apply and the requirement is not met

**EXAMPLES OF CORRECT CONDITIONAL HANDLING:**

Example 1: "Are you requesting surreptitious entry?"
- If the warrant does NOT request surreptitious entry → **N/A** (this section doesn't apply)
- If the warrant DOES request surreptitious entry but lacks required details → **FAIL**

Example 2: "Is it a criminal informant?"
- If there is no criminal informant involved → **N/A** (criminal informant requirements don't apply)
- If there IS a criminal informant but their track record isn't documented → **FAIL**

Example 3: "Is the claim of probable cause based on odors, aerial surveillance, etc.?"
- If probable cause is NOT based on these methods → **N/A**
- If it IS based on these methods but lacks required explanation → **FAIL**

**REMEMBER:** A conditional question answered "No" is NOT a deficiency - it simply means that category of requirements doesn't apply to this particular warrant.

**CONFIDENCE LEVEL DEFINITIONS:**
- **HIGH**: The document explicitly and clearly addresses the requirement with specific details
- **MEDIUM**: The document addresses the requirement but with some ambiguity or limited detail
- **LOW**: The requirement is only implied, marginally addressed, or the assessment requires significant interpretation

**EVIDENCE FIELD GUIDELINES:**
- If PASS: Quote or cite the specific language/section that satisfies the requirement
- If FAIL: State what is missing and what would be needed to satisfy the requirement
- If PARTIAL: Explain what is present and what is lacking
- If N/A: Explain why this requirement cannot be evaluated from the document alone (e.g., "This is a procedural question about actions taken by the affiant that cannot be verified from the document text alone")

**SPECIAL HANDLING - SPELL CHECK REQUIREMENT:**
For the checklist item "Have you spell checked the affidavit and warrant?" (or similar spell-check related items), you must ACTIVELY perform a spell check of the document:
1. Scan the entire document for spelling errors
2. Identify any misspelled words (excluding proper nouns, case numbers, legal terms, and abbreviations)
3. In the evidence field:
   - If NO errors found: "No spelling errors detected in the document."
   - If errors found: List each error with the misspelled word, the correct spelling, and where it appears. Example: "Found spelling errors: 'warrent' (should be 'warrant'), 'occurence' (should be 'occurrence'), 'recieved' (should be 'received')."
4. Status should be:
   - **PASS**: No spelling errors detected
   - **FAIL**: Multiple spelling errors found (3 or more)
   - **PARTIAL**: 1-2 minor spelling errors found

**IMPORTANT:**
- You MUST evaluate and return ALL checklist items - do not skip, consolidate, or omit any items
- Your response must contain exactly as many items as there are in the checklist above
- Return ONLY valid JSON - no markdown, no explanation text, no code blocks
- Maintain objectivity and legal precision
- For requirements that ask about actions or decisions made by the affiant that cannot be verified from the document, mark as N/A
- This analysis is for review purposes and does not constitute legal advice`,
    tags: ['swear', 'warrant', 'legal', 'analysis'],
    example: '',
    config: {} as AiSettings,
  },
];
