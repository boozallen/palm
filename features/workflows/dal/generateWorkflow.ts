import { AIFactory } from '@/features/ai-provider';
import { AiSettings } from '@/types';
import { processDocuments } from '@/features/chat/utils/chatContextHelpers';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import { PrimitiveConfig, PrimitiveType } from '@/features/workflows/types/primitive';
import { WORKFLOW_ARTIFACT_FILE_TYPES } from '@/features/shared/types/document';
import logger from '@/server/logger';
import getAvailableModels from '@/features/shared/dal/getAvailableModels';
import { AiProviderLabels } from '@/features/shared/types/ai-provider';
import { htmlInstructions } from '@/features/shared/constants/system-prompt';

interface GenerateWorkflowInput {
  description: string;
  documentIds: string[];
  userId: string;
  currentWorkflow?: PrimitiveConfig[];
}

export default async function generateWorkflow(
  ai: AIFactory,
  input: GenerateWorkflowInput,
): Promise<{ primitives: PrimitiveConfig[] }> {
  try {
    // Get available models for the user
    const availableModels = await getAvailableModels(input.userId);
    const firstModelId = availableModels.length > 0 ? availableModels[0].id : '';

    // Build model list with provider information for the LLM to choose from
    const modelsList = availableModels.map((model) => ({
      id: model.id,
      name: model.name,
      provider: AiProviderLabels[model.aiProviderTypeId as keyof typeof AiProviderLabels] || 'Unknown',
    }));

    // Build RAG context from selected documents
    let documentContext = '';
    if (input.documentIds.length > 0) {
      const ragResult = await processDocuments(
        input.description,
        input.userId,
        input.documentIds,
        false,
        false,
      );

      if (ragResult.citations.length > 0) {
        documentContext = addContextToMessage(
          'Analyze the following documents to understand their structure and content for workflow generation.',
          ragResult.citations,
        );
      }
    }

    const currentWorkflowSection = input.currentWorkflow && input.currentWorkflow.length > 0
      ? `
## Current Workflow (Regeneration Context)
The user has an existing workflow that they want you to improve or regenerate. Here is the current workflow definition:
\`\`\`json
${JSON.stringify(input.currentWorkflow, null, 2)}
\`\`\`
Consider this existing workflow when generating the new one. Preserve what works well, fix what doesn't, and optimize the overall structure based on the user's description.
`
      : '';

    const prompt = `
**Persona:**
You are an expert workflow architect. You design optimized, directed acyclic graph (DAG) workflows using a set of primitives. Your goal is to translate a user's process description and data sources into a structured workflow that achieves their outcome efficiently.

**Available Models:**
${modelsList.length > 0
  ? `The user has access to the following AI models. Choose the most appropriate model for each Prompt node based on the task requirements:
${modelsList.map((m, idx) => `${idx + 1}. **${m.name}** (${m.provider}) - ID: \`${m.id}\``).join('\n')}

**Model Selection Guidelines:**
- For complex reasoning, analysis, or synthesis tasks: prefer Claude (Anthropic) or GPT-4 models
- For simple extraction, classification, or straightforward tasks: any capable model works
- For code generation: prefer models known for coding (GPT-4, Claude)
- For creative writing: prefer models with strong language capabilities
- Default to the first model if uncertain
`
  : 'No models available. Use empty string "" for the model field.'}

**Available Primitives:**

1. **Document** (type: "${PrimitiveType.DOCUMENT}")
   - Loads a document from the user's document library into the workflow
   - Config: \`{ documentId: string }\`
   - Output: \`{ documents: [{ id, filename }], filename }\`
   - Use one Document node per document the user wants to include
   - Document nodes are typically the starting nodes of a workflow (no predecessors)

2. **Prompt** (type: "${PrimitiveType.PROMPT}")
   - Sends a prompt to an AI model with context from predecessor nodes
   - Config: \`{ model: string, prompt: string, temperature?: number, topP?: number }\`
   - The \`prompt\` field contains the full instruction text for the AI
   - Automatically receives document content from predecessor Document nodes via RAG
   - Automatically receives text output from predecessor Prompt nodes as context
   - Can have multiple predecessors (documents + other prompts feed into it)
   - Output: \`{ response: string }\`
   - Write detailed, specific prompts in the \`prompt\` field that tell the AI exactly what to do
   - Choose the most appropriate \`model\` from the available models list based on the task
   - Set \`temperature\` (0.0-1.0): use lower values (0.1-0.3) for analytical/factual tasks, higher values (0.7-0.9) for creative tasks
   - Set \`topP\` (0.0-1.0): use lower values (0.1-0.3) for focused outputs, higher values (0.8-1.0) for diverse outputs
   - If uncertain about temperature/topP, omit them to use system defaults

3. **Artifact** (type: "${PrimitiveType.ARTIFACT}")
   - Generates a downloadable file from the workflow output
   - Config: \`{ format: string, filename?: string }\`
   - Supported formats: ${WORKFLOW_ARTIFACT_FILE_TYPES.map(f => `"${f}"`).join(', ')}
   - **IMPORTANT:** The \`filename\` should NOT include the file extension — only the base name (e.g., "Analysis Report", not "Analysis Report.docx"). The extension comes from the \`format\` field.
   - Typically the terminal node of a workflow
   - Takes its content from predecessor Prompt node outputs

**HTML Artifact Design Guidelines:**

When designing Prompt nodes that generate HTML artifacts (format: ".html"), especially for presentations, interactive dashboards, or web-based visualizations, include specific design instructions in the prompt field.
${htmlInstructions}

**Workflow Structure Rules:**
- The workflow is a DAG (directed acyclic graph) — no cycles allowed
- Each node has a unique \`id\` (use descriptive slugs like "doc-1", "analyze-content", "generate-report")
- Nodes connect via \`predecessorIds\` — an array of node IDs that feed into this node
- Document nodes are entry points (no predecessorIds)
- Prompt nodes can have multiple predecessors (both Document and Prompt nodes)
- Artifact nodes are typically exit points
- Nodes execute in topological order; nodes in the same "wave" (no dependencies between them) run in parallel
- Position nodes on a canvas: x=180 is center, y increments by ~120 per row. Fan out horizontally for parallel nodes.

**Design Principles:**
- Think in terms of parent-child execution hierarchy: a parent step may spawn parallel child sub-processes when those children are truly independent (e.g., analyzing different documents, evaluating separate criteria). Merge children back into a synthesis Prompt when their results need combining.
- Break complex processes into discrete, focused Prompt steps rather than one monolithic prompt — but don't over-split trivial sub-tasks that belong together.
- Keep workflows compact: aim for 5–10 total nodes. Combine closely related sub-tasks into a single, detailed Prompt step.
- Use parallel branches when steps are genuinely independent (e.g., processing different documents, generating different output formats). Merge parallel branches into a synthesis Prompt node when results need combining.
- If additional reference documents are needed alongside the main input, place them as parallel entry points that feed into the same first Prompt node — not as separate processing branches.
- Write prompts that are specific and actionable — avoid vague instructions
- Include Artifact nodes at the end if the user's process implies deliverables
- **For HTML artifacts (presentations, interactive tools, dashboards):** When the workflow produces an HTML artifact, the Prompt node that generates it MUST include specific design aesthetic instructions and technical implementation requirements (see HTML Artifact Design Guidelines above). Default to "Corporate Minimal" for business contexts, "Tech Forward" for product demos, "Data-Driven" for analytics, "Magazine Editorial" for thought leadership, or "Executive Brief" for investor/board presentations.

${documentContext ? `**Document Context:**\n${documentContext}\n` : ''}
${currentWorkflowSection}
**User's Process Description:**
${input.description}

${input.documentIds.length > 0 ? `**Selected Documents (${input.documentIds.length}):** The user has selected ${input.documentIds.length} document(s) as data sources. Create one Document node for each, using these IDs: ${JSON.stringify(input.documentIds)}` : '**No documents selected.** The workflow should not include Document nodes unless the process clearly requires document input.'}

**Video Generation Workflows:**
If the user's description involves creating a video, slideshow, or presentation, you MUST use this exact structure. Do NOT deviate.

Our system has a pre-built video renderer. It does NOT accept React code, Remotion code, scene breakdowns, production notes, or any human-readable format. It ONLY accepts a JSON array of slide objects. The final Prompt node in any video workflow must produce that JSON array — nothing else.

The \`prompt\` field of the final video Prompt node must be EXACTLY this text (replace the bracketed placeholder with the actual topic):

\`\`\`
Using the content provided, output a JSON array of 8-12 slide objects for a video presentation. Each object must include: "id" (e.g. "slide-1"), "heading" (3-6 word headline), "narration" (the spoken words for this slide), "layout" (one of: title, text, image-right, bullets, full-image), "imageSearchTerm" (2-4 word image keyword), and either "body" (1-2 sentences) OR "bullets" (array of strings) — not both. Use "title" layout for the opening and closing slides. Output ONLY the raw JSON array. Start with [ and end with ]. No markdown, no explanation, no code fences.
\`\`\`

- The artifact node after the video prompt node MUST use format ".mp4"
- layout guide: "title" = opening/closing, "text" = narration-heavy, "image-right" = text + visual, "bullets" = lists, "full-image" = dramatic moments
- Do NOT create a node that asks for scene breakdowns, production notes, screenplay format, or React/Remotion code

**Instructions:**
1. Analyze the user's process description and document context
2. Design an optimized workflow DAG that achieves their goal
3. Output ONLY a valid JSON array of PrimitiveConfig objects
4. Do not include any markdown, explanation, or text outside the JSON array
5. Ensure all predecessorIds reference valid node IDs within the workflow
6. Position nodes logically on the canvas (x/y coordinates)
7. For video generation workflows, copy the exact prompt text from the Video Generation section above into the final Prompt node's prompt field — do not paraphrase or rewrite it
8. For Artifact nodes: never include file extensions in the \`filename\` field — the extension is specified separately in the \`format\` field

**Output Format:**
A JSON array of objects, each with: id, type, name, config, position, predecessorIds (optional).
Example (showing analytical task with appropriate settings):
[
  { "id": "doc-1", "type": "document", "name": "Source Document", "config": { "documentId": "uuid-here" }, "position": { "x": 180, "y": 20 } },
  { "id": "analyze", "type": "prompt", "name": "Analyze Content", "config": { "model": "${firstModelId}", "prompt": "Analyze the provided document...", "temperature": 0.2, "topP": 0.2 }, "position": { "x": 180, "y": 140 }, "predecessorIds": ["doc-1"] },
  { "id": "report", "type": "artifact", "name": "Analysis Report", "config": { "format": ".docx", "filename": "Analysis Report" }, "position": { "x": 180, "y": 260 }, "predecessorIds": ["analyze"] }
]

For creative tasks, use higher temperature/topP (e.g., 0.7-0.9). For factual/analytical tasks, use lower values (e.g., 0.1-0.3). Omit if default is appropriate.
`;

    const systemAi = await ai.buildSystemSource();

    const aiSettings: AiSettings = {
      model: systemAi.model.externalId,
      temperature: 0.4,
      topP: 0.3,
    };

    const aiResponse = await systemAi.source.completion(
      prompt,
      aiSettings,
    );

    // Parse the JSON response
    let primitives: PrimitiveConfig[] = [];
    try {
      // Strip markdown code fences if present
      let responseText = aiResponse.text.trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(responseText) as PrimitiveConfig[];

      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      // Validate each primitive has required fields
      primitives = parsed.reduce<PrimitiveConfig[]>((valid, p) => {
        if (
          p.id &&
          p.type &&
          Object.values(PrimitiveType).includes(p.type as PrimitiveType) &&
          p.name &&
          p.config
        ) {
          // For Prompt nodes, ensure model is set to the first available model
          const config = p.type === PrimitiveType.PROMPT && (!p.config.model || p.config.model === '')
            ? { ...p.config, model: firstModelId }
            : p.config;

          valid.push({
            id: p.id,
            type: p.type,
            name: p.name,
            config,
            position: p.position,
            predecessorIds: p.predecessorIds,
          });
        }
        return valid;
      }, []);
    } catch (parseError) {
      logger.error('Failed to parse workflow generation response', {
        error: parseError,
        response: aiResponse.text,
      });
      throw new Error('Failed to generate a valid workflow structure. Please try again.');
    }

    if (primitives.length === 0) {
      throw new Error('No valid workflow nodes were generated. Please try again with a more detailed description.');
    }

    return { primitives };
  } catch (error) {
    logger.error('Error generating workflow', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error generating workflow');
  }
}
