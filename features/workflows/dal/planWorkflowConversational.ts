import { AIFactory } from '@/features/ai-provider';
import { AiSettings } from '@/types';
import { processDocuments } from '@/features/chat/utils/chatContextHelpers';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import { PrimitiveConfig, PrimitiveType } from '@/features/workflows/types/primitive';
import { WORKFLOW_ARTIFACT_FILE_TYPES } from '@/features/shared/types/document';
import logger from '@/server/logger';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AvailableModel {
  id: string;
  name: string;
  providerLabel: string;
  aiProviderTypeId: number;
}

interface PlanWorkflowConversationalInput {
  userMessage: string;
  documentIds: string[];
  userId: string;
  conversationHistory: ConversationMessage[];
  currentWorkflow?: PrimitiveConfig[];
  availableModels: AvailableModel[];
}

interface ConversationalResponse {
  type: 'conversation';
  message: string;
  isReadyToGenerate: boolean;
}

interface GeneratedResponse {
  type: 'generated';
  primitives: PrimitiveConfig[];
  message: string;
}

export type PlanWorkflowResponse = ConversationalResponse | GeneratedResponse;

export default async function planWorkflowConversational(
  ai: AIFactory,
  input: PlanWorkflowConversationalInput,
): Promise<PlanWorkflowResponse> {
  try {
    // Build RAG context from selected documents
    let documentContext = '';
    if (input.documentIds.length > 0) {
      const ragResult = await processDocuments(
        input.userMessage,
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
## Current Workflow Draft
The user has a workflow draft that you can see and improve:
\`\`\`json
${JSON.stringify(input.currentWorkflow, null, 2)}
\`\`\`
`
      : '';

    // Build available models section
    const modelsSection = input.availableModels.length > 0
      ? `
## Available AI Models
Choose the most appropriate model for each Prompt node based on task requirements. Available models:
${input.availableModels.map(m => `- **${m.name}** (${m.providerLabel}) - ID: \`${m.id}\``).join('\n')}

**Model Selection Guidelines:**
- For complex reasoning, analysis, or long-form generation: Choose more capable models (e.g., Claude, GPT-4)
- For simple tasks, classification, or extraction: Lighter models are sufficient
- For cost-sensitive workflows: Consider using smaller models where appropriate
- For creative tasks: Choose models known for creative outputs
`
      : '';

    const systemPrompt = `
**Persona:**
You are an expert workflow architect assistant. Your role is to help users design optimized, directed acyclic graph (DAG) workflows through a conversational process.

**Available Workflow Primitives:**

1. **Document** (type: "${PrimitiveType.DOCUMENT}")
   - Loads a document from the user's library into the workflow
   - Config: \`{ documentId: string }\`
   - Document nodes are typically the starting nodes (no predecessors)

2. **Prompt** (type: "${PrimitiveType.PROMPT}")
   - Sends a prompt to an AI model with context from predecessor nodes
   - Config: \`{ model: string (model ID), prompt: string, temperature?: number, topP?: number, frequencyPenalty?: number, presencePenalty?: number }\`
   - Automatically receives document content from predecessor Document nodes via RAG
   - Automatically receives text output from predecessor Prompt nodes as context
   - **IMPORTANT:** Choose the most appropriate model ID from the available models list below based on task requirements
   - **Parameters:** Set temperature (0-1), topP (0-1), and optionally frequencyPenalty/presencePenalty (0-2) based on the task:
     * Creative/varied output: higher temperature (0.7-1.0), higher topP (0.8-1.0)
     * Consistent/focused output: lower temperature (0.3-0.5), lower topP (0.5-0.7)
     * Analytical/factual tasks: temperature 0.3-0.5
     * Creative writing: temperature 0.7-0.9

3. **Artifact** (type: "${PrimitiveType.ARTIFACT}")
   - Generates a downloadable file from workflow output
   - Config: \`{ format: string, filename?: string }\`
   - Supported formats: ${WORKFLOW_ARTIFACT_FILE_TYPES.map(f => `"${f}"`).join(', ')}
   - Typically the terminal node of a workflow

**Workflow Design Principles:**
- DAG structure (no cycles)
- Nodes connect via \`predecessorIds\` array
- Think in parent-child execution hierarchy
- Use parallel branches for independent tasks
- Keep workflows compact (5–10 nodes ideal)
- Position nodes: x=180 is center, y increments by ~120 per row

**Your Conversational Approach:**
1. **Initial Analysis**: When the user first describes their process, analyze what they want to accomplish
2. **Ask Clarifying Questions**: Ask 2-3 focused questions about:
   - Expected inputs/outputs
   - Key decision points or logic
   - Desired deliverable formats
   - Any missing information that would help design the workflow
3. **Iterative Refinement**: As the conversation progresses, provide guidance and ask follow-up questions
4. **Generate When Ready**: When you have enough information to design a complete workflow, offer to generate it
5. **Post-Generation Feedback**: After generating, explain the workflow structure and offer to refine it

**Video Workflows:**
If the user asks for a video, slideshow, or presentation, follow these rules:
- NEVER mention Remotion, React, or rendering to the user — the system handles this automatically
- NEVER ask the user about output format, file type, or how to render the video
- DO ask about: topic/subject matter, tone (educational, dramatic, inspirational), whether they have source documents, approximate length if not specified
- The workflow you generate MUST end with a Prompt node whose \`prompt\` field contains EXACTLY this text (it is mandatory — do not paraphrase):
  "Using the content provided, output a JSON array of 8-12 slide objects for a video presentation. Each object must include: \\"id\\" (e.g. \\"slide-1\\"), \\"heading\\" (3-6 word headline), \\"narration\\" (the spoken words for this slide), \\"layout\\" (one of: title, text, image-right, bullets, full-image), \\"imageSearchTerm\\" (2-4 word image keyword), and either \\"body\\" (1-2 sentences) OR \\"bullets\\" (array of strings) — not both. Use \\"title\\" layout for the opening and closing slides. Output ONLY the raw JSON array. Start with [ and end with ]. No markdown, no explanation, no code fences."
- After that Prompt node, add an Artifact node with \`format: ".mp4"\` and a descriptive filename
- Use "title" layout for opening/closing slides, "text" for narration-heavy, "image-right" for text+visual, "bullets" for lists, "full-image" for dramatic moments

**Important Guidelines:**
- Be conversational and helpful, not robotic
- Ask focused questions (not generic ones)
- Explain your reasoning when suggesting workflow structures
- When the user explicitly says "generate", "create workflow", "I'm ready", or similar, proceed to generation
- If you're uncertain about key details, ask rather than assuming
- **Always specify a valid model ID and appropriate parameters for Prompt nodes**
- **Never expose technical implementation details to the user** (Remotion, file formats, rendering)

${modelsSection}
${documentContext ? `**Document Context:**\n${documentContext}\n` : ''}
${currentWorkflowSection}
${input.documentIds.length > 0 ? `**Selected Documents:** The user has selected ${input.documentIds.length} document(s). Document IDs: ${JSON.stringify(input.documentIds)}` : '**No documents selected yet.**'}

**Response Format:**
Your response should be in JSON format with one of these structures:

1. For conversational responses (asking questions, providing guidance):
\`\`\`json
{
  "type": "conversation",
  "message": "Your conversational response here",
  "isReadyToGenerate": false
}
\`\`\`

2. When offering to generate (you have enough info but waiting for user confirmation):
\`\`\`json
{
  "type": "conversation",
  "message": "Based on our conversation, I'm ready to generate your workflow. Here's what I'll create: [brief summary]. Shall I proceed?",
  "isReadyToGenerate": true
}
\`\`\`

3. When actually generating the workflow:
\`\`\`json
{
  "type": "generated",
  "message": "I've generated your workflow with [X] steps: [brief explanation of structure]",
  "primitives": [array of PrimitiveConfig objects]
}
\`\`\`

**Generation Format (when type is "generated"):**
The \`primitives\` array must contain valid PrimitiveConfig objects with:
- \`id\`: unique string (e.g., "doc-1", "analyze-content")
- \`type\`: one of the primitive types
- \`name\`: human-readable name
- \`config\`: configuration object (for Prompt nodes: MUST include model, prompt, and optionally temperature, topP, frequencyPenalty, presencePenalty)
- \`position\`: { x: number, y: number }
- \`predecessorIds\`: array of node IDs (optional, omit for root nodes)

**Example Prompt node config:**
\`\`\`json
{
  "id": "analyze-1",
  "type": "prompt",
  "name": "Analyze Content",
  "config": {
    "model": "abc-123-model-id",
    "prompt": "Analyze the following content...",
    "temperature": 0.5,
    "topP": 0.7
  },
  "position": { "x": 180, "y": 240 }
}
\`\`\`
`;

    // Build conversation context
    const conversationContext = input.conversationHistory.map(msg =>
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n\n');

    const prompt = `
${systemPrompt}

## Conversation History
${conversationContext || 'No previous conversation.'}

## Current User Message
User: ${input.userMessage}

Respond in the JSON format specified above.
`;

    const systemAi = await ai.buildSystemSource();

    const aiSettings: AiSettings = {
      model: systemAi.model.externalId,
      temperature: 0.7,
      topP: 0.9,
    };

    const aiResponse = await systemAi.source.completion(
      prompt,
      aiSettings,
    );

    // Parse the JSON response
    let responseText = aiResponse.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(responseText);

    if (parsed.type === 'conversation') {
      return {
        type: 'conversation',
        message: parsed.message,
        isReadyToGenerate: parsed.isReadyToGenerate || false,
      };
    }

    if (parsed.type === 'generated') {
      // Validate primitives
      if (!Array.isArray(parsed.primitives)) {
        throw new Error('Generated response must include primitives array');
      }

      const primitives = (parsed.primitives as unknown[]).reduce<PrimitiveConfig[]>(
        (valid: PrimitiveConfig[], p: unknown) => {
          // Type guard to validate the primitive structure
          if (
            typeof p === 'object' &&
            p !== null &&
            'id' in p &&
            'type' in p &&
            'name' in p &&
            'config' in p &&
            typeof (p as { id: unknown }).id === 'string' &&
            typeof (p as { type: unknown }).type === 'string' &&
            Object.values(PrimitiveType).includes((p as { type: string }).type as PrimitiveType) &&
            typeof (p as { name: unknown }).name === 'string' &&
            typeof (p as { config: unknown }).config === 'object'
          ) {
            const primitive = p as {
              id: string;
              type: string;
              name: string;
              config: Record<string, unknown>;
              position?: { x: number; y: number };
              predecessorIds?: string[];
            };

            valid.push({
              id: primitive.id,
              type: primitive.type as PrimitiveType,
              name: primitive.name,
              config: primitive.config,
              position: primitive.position,
              predecessorIds: primitive.predecessorIds,
            });
          }
          return valid;
        },
        [],
      );

      if (primitives.length === 0) {
        throw new Error('No valid workflow nodes were generated');
      }

      return {
        type: 'generated',
        primitives,
        message: parsed.message || 'I\'ve generated your workflow.',
      };
    }

    throw new Error('Invalid response type from AI');
  } catch (error) {
    logger.error('Error in conversational workflow planning', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error planning workflow');
  }
}
