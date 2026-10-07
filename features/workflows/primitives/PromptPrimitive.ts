/**
 * Prompt Primitive
 * Sends prompts to AI models and returns responses
 */

import { BasePrimitive } from '@/features/workflows/primitives/BasePrimitive';
import {
  PrimitiveContext,
  PrimitiveResult,
  PrimitiveType,
  PromptConfig,
} from '@/features/workflows/types/primitive';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { BuildResult } from '@/features/ai-agents/types/factoryAdapter';
import { processDocuments } from '@/features/chat/utils/chatContextHelpers';
import db from '@/server/db';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import getUserGraphDatabaseAccess from '@/features/shared/dal/getUserGraphDatabaseAccess';
import { formatGraphContextForLLM } from '@/features/chat/dal/formatGraphContext';
import { ContextType } from '@/features/chat/types/message';

export class PromptPrimitive extends BasePrimitive {
  private readonly promptConfig: PromptConfig;
  private ai?: BuildResult;

  constructor(config: any, ai?: BuildResult) {
    super({
      ...config,
      type: PrimitiveType.PROMPT,
    });
    this.promptConfig = config.config as PromptConfig;
    this.ai = ai;
  }

  /**
   * Set the AI instance (needed for execution)
   */
  setAI(ai: BuildResult) {
    this.ai = ai;
  }

  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    const baseValidation = await super.validate();
    const errors = baseValidation.errors || [];

    if (!this.promptConfig.prompt && !this.promptConfig.promptId) {
      errors.push('Prompt is required for LLM primitive');
    }

    if (!this.promptConfig.model) {
      errors.push('Model is required for LLM primitive');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async execute(context: PrimitiveContext): Promise<PrimitiveResult> {
    if (!this.shouldExecute(context)) {
      return this.success({ skipped: true }, { reason: 'Condition not met' });
    }

    if (!this.ai) {
      return this.error('AI instance not configured');
    }

    try {
      const adapter = new AiFactoryCompletionAdapter(this.ai, {
        temperature: this.promptConfig.temperature ?? 0.7,
        topP: this.promptConfig.topP ?? 0.5,
        frequencyPenalty: this.promptConfig.frequencyPenalty ?? 0,
        presencePenalty: this.promptConfig.presencePenalty ?? 0,
      });

      const basePrompt = this.promptConfig.prompt || await this.resolvePromptText();
      const finalPrompt = await this.buildFinalPrompt(context, basePrompt);

      let response;
      if (this.promptConfig.systemMessage) {
        response = await adapter.chat({
          messages: [
            { role: 'system', content: this.promptConfig.systemMessage },
            { role: 'user', content: finalPrompt },
          ],
        });
      } else {
        response = await adapter.complete({ prompt: finalPrompt });
      }

      const responseText =
        'text' in response ? response.text : response.message.content;

      // Collect citations and graph anchors from RAG processing
      const ragResult = await this.getRagResultsForOutput(context, basePrompt);

      // Include citations and graph anchors in the response output
      const outputWithCitations = {
        response: responseText,
        citations: ragResult.citations,
        graphAnchors: ragResult.graphAnchors,
      };

      return this.success(
        outputWithCitations,
        { model: this.promptConfig.model, prompt: basePrompt }
      );
    } catch (error) {
      return this.error(
        `Failed to execute LLM prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Builds the complete final prompt for this node, with context from predecessor
   * steps placed after the prompt instruction — matching the chat format.
   *
   * For documents: uses addContextToMessage(prompt, citations) so the prompt
   * appears in ## User message: and retrieved context follows beneath it.
   * For text responses: appends predecessor output after the prompt.
   */
  private async resolvePromptText(): Promise<string> {
    if (!this.promptConfig.promptId) { return ''; }
    const record = await db.prompt.findUnique({
      where: { id: this.promptConfig.promptId },
      select: { instructions: true },
    });
    return record?.instructions ?? '';
  }

  private async buildFinalPrompt(context: PrimitiveContext, prompt: string): Promise<string> {
    const sections: string[] = [];
    const { predecessorIds } = this.config;
    const documentIds: string[] = [];
    const filenames: string[] = [];

    // Collect document IDs and text responses from predecessors
    if (predecessorIds && predecessorIds.length > 0) {
      for (const predId of predecessorIds) {
        const predOutput = context.state[predId];
        if (!predOutput) { continue; }

        if (Array.isArray(predOutput.documents)) {
          for (const doc of predOutput.documents) {
            if (doc.id) {
              documentIds.push(doc.id);
              if (doc.name) {
                filenames.push(doc.name);
              }
            }
          }
        } else if (predOutput.response && typeof predOutput.response === 'string') {
          sections.push(`[Previous step output:]\n${predOutput.response}`);
        }
      }
    } else {
      // Fallback: no graph edge info — use context.input directly
      if (Array.isArray(context.input.documents)) {
        for (const doc of context.input.documents) {
          if (doc.id) {
            documentIds.push(doc.id);
            if (doc.name) {
              filenames.push(doc.name);
            }
          }
        }
      } else if (context.input.response && typeof context.input.response === 'string') {
        sections.push(context.input.response);
      }
    }

    // Add context for documents
    if (filenames.length > 0) {
      const fileList = filenames.map(filename => `${filename}`).join('\n');
      const str = `You have access to ${filenames.length} file${filenames.length === 1 ? '' : 's'}:\n${fileList}.`;
      prompt = `${str}\n\n${prompt}`;
    }

    // Process documents using RAG if we have any
    if (documentIds.length > 0) {
      try {
        const hasGraphAccess = await getUserGraphDatabaseAccess(context.userId);
        const useGraph = hasGraphAccess && (this.promptConfig.useGraph ?? false);

        const ragResult = await processDocuments(
          prompt,
          context.userId,
          documentIds,
          false, // Don't throw on error in workflow context
          useGraph,
          {
            workflowExecutionId: context.executionId,
            primitiveId: this.config.id,
            stepLabel: 'query embedding',
          },
        );

        // Pass the prompt to addContextToMessage so it appears first,
        // matching the ## User message: / ## Additional Contextual Information: format used in chat
        if (ragResult.citations.length > 0) {
          const promptWithSections = sections.length > 0
            ? `${prompt}\n\n${sections.join('\n\n')}`
            : prompt;
          const contextMessage = addContextToMessage(promptWithSections, ragResult.citations);
          if (contextMessage.trim()) { return contextMessage; }
        }

        if (ragResult.graphContext) {
          const graphSection = formatGraphContextForLLM(ragResult.graphContext, new Map());
          if (graphSection.trim()) { sections.push(graphSection); }
        }
      } catch (error) {
        // Don't add fallback text that could contaminate context
      }
    }

    if (sections.length === 0) { return prompt; }
    return `${prompt}\n\n${sections.join('\n\n')}`;
  }

  /**
   * Collect RAG results (citations only for now) for workflow output
   */
  private async getRagResultsForOutput(context: PrimitiveContext, prompt: string): Promise<{
    citations: any[];
    graphAnchors: any[];
  }> {
    const { predecessorIds } = this.config;
    const documentIds: string[] = [];

    // Collect document IDs from predecessors or context input
    if (predecessorIds && predecessorIds.length > 0) {
      for (const predId of predecessorIds) {
        const predOutput = context.state[predId];
        if (!predOutput || !Array.isArray(predOutput.documents)) { continue; }

        for (const doc of predOutput.documents) {
          if (doc.id) {
            documentIds.push(doc.id);
          }
        }
      }
    } else if (Array.isArray(context.input.documents)) {
      for (const doc of context.input.documents) {
        if (doc.id) {
          documentIds.push(doc.id);
        }
      }
    }

    // If no documents, return empty results
    if (documentIds.length === 0) {
      return { citations: [], graphAnchors: [] };
    }

    try {
      // Process documents using RAG (no graph for now)
      // This is a second retrieval: buildFinalPrompt already embedded this
      // primitive's prompt to assemble the LLM context, but returns only a
      // string, so the citations are re-derived here for the output. The
      // provider bills both embeddings, so both are attributed — otherwise the
      // per-artifact total silently omits this one.
      const ragResult = await processDocuments(
        prompt,
        context.userId,
        documentIds,
        false, // Don't throw on error in workflow context
        false, // Disable graph for now
        {
          workflowExecutionId: context.executionId,
          primitiveId: this.config.id,
          stepLabel: 'output citations',
        },
      );

      // Format citations for output
      const citations = ragResult.citations.map(citation => {
        const baseCitation = {
          id: citation.sourceLabel,
          content: citation.citation,
          source: citation.sourceLabel,
          contextType: citation.contextType,
        };
        
        // Add type-specific fields based on contextType
        if (citation.contextType === ContextType.DOCUMENT_LIBRARY) {
          return {
            ...baseCitation,
            documentId: citation.documentId,
            embeddingId: citation.embeddingId,
            startPosition: citation.startPosition,
            endPosition: citation.endPosition,
          };
        }
        
        return baseCitation;
      });

      // Return only citations for now (no graph anchors)
      return { citations, graphAnchors: [] };

    } catch (error) {
      // Return empty results on error, don't fail the workflow
      return { citations: [], graphAnchors: [] };
    }
  }
}
