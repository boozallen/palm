import { Worker } from 'bullmq';
import { z } from 'zod';

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { OdramJobData } from './queue';
import { getRedisClient } from '@/server/storage/redisConnection';
import {
  DEFAULT_WORKER_CONFIG,
  WORKER_SHUTDOWN_TIMEOUT,
} from '@/features/ai-agents/utils/shared/types';
import { AIFactory } from '@/features/ai-provider/factory';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { parseFile } from '@/features/document-upload-provider/sources/utils/file-helpers';
import parseOdramSpreadsheet from './parseOdramSpreadsheet';
import parsePromptMatrix from './parsePromptMatrix';
import { assembleQuestionPrompt, getSystemPrompt } from './assemblePrompt';
import { ODRAM_SYSTEM_PROMPT } from '@/features/ai-agents/data/odram/system-prompt';
import {
  OdramRiskRating,
} from '@/features/ai-agents/types/odram/analysisResult';
import type { PromptMatrixData } from '@/features/ai-agents/types/odram/promptMatrix';
import updateOdramJobStatus from '@/features/ai-agents/dal/odram/updateOdramJobStatus';
import saveOdramResult from '@/features/ai-agents/dal/odram/saveOdramResult';
import updateOdramJobSummary from '@/features/ai-agents/dal/odram/updateOdramJobSummary';

const questionResultSchema = z.object({
  independentRating: z.nativeEnum(OdramRiskRating),
  overallAssessment: z.string(),
  keyFeedback: z.array(z.string()),
});

type ParsedOdramResponse = {
  questionName: string;
  teamRating: string;
  teamRationale: string;
  teamMitigation: string;
  riskDefinitions: {
    low: string;
    moderate: string;
    high: string;
  };
};

const teamResponseSchema = z.object({
  questionName: z.string(),
  teamRating: z.string(),
  teamRationale: z.string(),
  teamMitigation: z.string(),
  riskDefinitions: z.object({
    low: z.string(),
    moderate: z.string(),
    high: z.string(),
  }),
});

const extractionResponseSchema = z.object({
  questions: z.array(teamResponseSchema),
});

/**
 * Uses the LLM to extract team responses from the raw ODRAM PDF text.
 *
 * Instead of fragile regex parsing, we pass the entire ODRAM form text
 * plus the known list of question names to the LLM, and let it return
 * structured data for each question. This handles all PDF extraction
 * quirks (radio buttons, page breaks, column ordering) because the LLM
 * understands the document semantically.
 */
async function extractTeamResponses(
  odramText: string,
  completionAdapter: AiFactoryCompletionAdapter,
  matrixData: PromptMatrixData,
): Promise<ParsedOdramResponse[]> {
  const questionList = matrixData.questions
    .map((q) => `${q.id}. ${q.name}`)
    .join('\n');

  const extractionPrompt = `You are a structured data extraction assistant. Below is the raw text extracted from a completed ODRAM (Opportunity Delivery Risk Assessment Matrix) PDF form. The form contains team self-assessments for each risk decision element.

For each of the following ${matrixData.questions.length} ODRAM questions, extract the Proposal Team's responses:

${questionList}

For EACH question above, extract:
1. **riskDefinitions** — The "Element Risk Criteria Description" for that question. Extract the exact Low, Moderate, and High definitions as written in the form.
2. **teamRating** — The team's selected risk rating: "Low", "Moderate", or "High". Look for radio button indicators (⊙, ◉, ✓, ✔, ☑), selected/checked marks, or the rating written near "Proposal Team Rating/Evaluation". If you cannot determine the rating, use "Not provided".
3. **teamRationale** — The full text under "Proposal Team Rationale" for that question. Copy it verbatim. If not found, use "Not provided".
4. **teamMitigation** — The full text under "Proposal Team Mitigation Approach" for that question. Copy it verbatim. If not found, use "N/A".

IMPORTANT:
- The PDF text may have garbled formatting, page breaks, repeated headers, or out-of-order columns. Use your understanding of the document structure to extract the correct data.
- Match each section to the correct question by looking at the "Decision Element" labels in the form.
- Use the question name exactly as listed above for "questionName".

Return ONLY a JSON object in this format:
{
  "questions": [
    {
      "questionName": "Acceptance Criteria / Performance Objectives",
      "riskDefinitions": {
        "low": "Clear, objective, achievable measures for deliverable acceptance with clear client responsibilities.",
        "moderate": "Mix of objective/subjective measures for acceptance.",
        "high": "1) Subjective, difficult, inflexible or No acceptance criteria, or 2) Specific system/subsystem/product performance/timing requirements."
      },
      "teamRating": "Low",
      "teamRationale": "The team's rationale text...",
      "teamMitigation": "The team's mitigation text..."
    },
    ...
  ]
}

--- ODRAM FORM TEXT ---
${odramText}`;

  const response = await completionAdapter.chat({
    messages: [
      { role: 'system', content: 'You are a precise data extraction assistant. Extract structured data from documents. Return only valid JSON.' },
      { role: 'user', content: extractionPrompt },
    ],
  });

  const text = response.message.content
    .replace(/^```(?:json)?\n?|\n?```$/g, '')
    .trim();

  const json = JSON.parse(text);
  const validated = extractionResponseSchema.safeParse(json);

  if (validated.success) {
    return validated.data.questions;
  }

  logger.warn('LLM extraction Zod validation failed, using raw JSON', {
    error: validated.error.message,
  });

  // Fallback: try to use the raw JSON array
  if (Array.isArray(json.questions)) {
    return json.questions as ParsedOdramResponse[];
  }

  return [];
}

/**
 * Matches an extracted ODRAM response to a question by name.
 */
function findResponseForQuestion(
  responses: ParsedOdramResponse[],
  questionName: string,
): ParsedOdramResponse | undefined {
  // Try exact match first (LLM should return the exact name we gave it)
  const exact = responses.find(
    (r) => r.questionName.toLowerCase() === questionName.toLowerCase(),
  );
  if (exact) {
    return exact;
  }

  // Fallback: substring match
  const substring = responses.find(
    (r) => questionName.toLowerCase().includes(r.questionName.toLowerCase())
      || r.questionName.toLowerCase().includes(questionName.toLowerCase()),
  );
  if (substring) {
    return substring;
  }

  // Last resort: keyword match
  const keywords = questionName
    .toLowerCase()
    .split(/[\s/]+/)
    .filter((w) => w.length > 3);

  return responses.find((r) => {
    const rLower = r.questionName.toLowerCase();
    return keywords.some((kw) => rLower.includes(kw));
  });
}

let worker: Worker | null = null;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`${signal} received, shutting down ODRAM worker...`);

  try {
    await storage.del('worker:odram:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down ODRAM worker after timeout');
        throw new Error('Force ODRAM worker shutdown due to timeout');
      }, WORKER_SHUTDOWN_TIMEOUT);
      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('ODRAM worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down ODRAM worker:', error);
    throw error;
  }
};

export const startOdramWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping ODRAM queue/worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping ODRAM worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('ODRAM worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<OdramJobData>(
    'odram-jobs',
    async (job) => {
      const {
        jobId,
        userId,
        modelId,
        promptMatrixFileKey,
        promptMatrixFileName,
        odramFileKey,
        odramFileName,
        odramContentType,
        proposalFiles,
        documentUploadProviderId,
        documentMapping,
        questionContext,
      } = job.data;

      const storageProvider = await (async () => {
        const factory = new DocumentUploadFactory({ userId });
        const { source } = await factory.buildSource(documentUploadProviderId);
        return source;
      })();

      // Collect all file keys for cleanup
      const allFileKeys = [promptMatrixFileKey, odramFileKey, ...proposalFiles.map((f) => f.fileKey)];

      try {
        await storage.hset(`odram-job:${jobId}`, {
          status: 'processing',
          progress: 'Fetching uploaded files...',
          created: Date.now(),
          last_updated: Date.now(),
        });
        await updateOdramJobStatus(jobId, 'processing');

        logger.info('Starting ODRAM analysis', {
          jobId,
          modelId,
          promptMatrixFileName,
          proposalFileCount: proposalFiles.length,
        });

        // Step 1: Fetch all files from S3
        const promptMatrixBuffer = await storageProvider.fetchFile(promptMatrixFileKey);
        const odramBuffer = await storageProvider.fetchFile(odramFileKey);
        const proposalBuffers = await Promise.all(
          proposalFiles.map(async (f) => ({
            buffer: await storageProvider.fetchFile(f.fileKey),
            fileName: f.fileName,
            contentType: f.contentType,
          })),
        );

        // Step 2: Parse Prompt Matrix
        await storage.hset(`odram-job:${jobId}`, {
          progress: 'Parsing Prompt Matrix...',
          last_updated: Date.now(),
        });

        const matrixData = await parsePromptMatrix(promptMatrixBuffer);

        // Set totalQuestions dynamically from the matrix
        await storage.hset(`odram-job:${jobId}`, {
          totalQuestions: matrixData.questions.length,
          last_updated: Date.now(),
        });

        logger.info('Parsed Prompt Matrix', {
          jobId,
          questionCount: matrixData.questions.length,
          hasPersona: !!matrixData.persona,
        });

        // Step 3: Parse ODRAM response and proposal documents
        await storage.hset(`odram-job:${jobId}`, {
          progress: 'Parsing documents...',
          last_updated: Date.now(),
        });

        const isXlsx = odramContentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          || odramFileName.endsWith('.xlsx');

        // For PDF/docx we still need the raw text for LLM extraction; for xlsx we parse directly later
        let odramResponsesText: string | null = null;
        if (!isXlsx) {
          odramResponsesText = await parseFile(odramBuffer, odramContentType);
          if (!odramResponsesText || odramResponsesText.trim().length === 0) {
            throw new Error(`No text could be extracted from ODRAM file: ${odramFileName}`);
          }
        }

        const documentTexts: { filename: string; text: string }[] = [];
        for (const proposal of proposalBuffers) {
          try {
            const text = await parseFile(proposal.buffer, proposal.contentType);
            if (text && text.trim().length > 0) {
              documentTexts.push({ filename: proposal.fileName, text });
            } else {
              logger.warn('Empty text extracted from proposal file', { fileName: proposal.fileName });
            }
          } catch (parseError) {
            logger.error('Failed to parse proposal file', {
              fileName: proposal.fileName,
              error: (parseError as Error).message,
            });
            throw new Error(`Failed to parse proposal file: ${proposal.fileName}`);
          }
        }

        if (documentTexts.length === 0) {
          throw new Error('No text could be extracted from any proposal documents.');
        }

        // Step 4: Helper to build per-question document context
        const buildDocumentContext = (questionId: number): string => {
          if (!documentMapping) {
            // null mapping = all docs for all questions (backward compatible)
            return documentTexts
              .map((doc) => `=== DOCUMENT: ${doc.filename} ===\n${doc.text}`)
              .join('\n\n');
          }

          const allowedFiles = documentMapping[questionId];
          if (!allowedFiles || allowedFiles.length === 0) {
            return '(No documents selected for this question.)';
          }

          const allowedSet = new Set(allowedFiles);
          return documentTexts
            .filter((doc) => allowedSet.has(doc.filename))
            .map((doc) => `=== DOCUMENT: ${doc.filename} ===\n${doc.text}`)
            .join('\n\n');
        };

        // Step 5: Initialize AI
        await storage.hset(`odram-job:${jobId}`, {
          progress: 'Initializing AI model...',
          last_updated: Date.now(),
        });

        const ai = new AIFactory({ userId });
        const aiSource = await ai.buildUserSource(modelId);
        const completionAdapter = new AiFactoryCompletionAdapter(aiSource);

        // Step 6: Extract team responses — xlsx is parsed directly, PDF/docx falls back to LLM
        let parsedResponses: ParsedOdramResponse[];

        // Build question name map from the matrix for the xlsx parser
        const questionNameMap = new Map(
          matrixData.questions.map((q) => [q.id, q.name]),
        );

        if (isXlsx) {
          await storage.hset(`odram-job:${jobId}`, {
            progress: 'Parsing ODRAM spreadsheet...',
            last_updated: Date.now(),
          });

          parsedResponses = await parseOdramSpreadsheet(odramBuffer, questionNameMap);
        } else {
          await storage.hset(`odram-job:${jobId}`, {
            progress: 'Extracting team responses from ODRAM form...',
            last_updated: Date.now(),
          });

          parsedResponses = await extractTeamResponses(odramResponsesText!, completionAdapter, matrixData);
        }

        logger.info('Extracted ODRAM team responses', {
          jobId,
          source: isXlsx ? 'xlsx' : 'llm',
          extractedCount: parsedResponses.length,
          extractedQuestions: parsedResponses.map((r) => ({
            name: r.questionName,
            rating: r.teamRating,
          })),
        });

        // Resolve the system prompt from the matrix (falls back to hardcoded)
        const systemPrompt = getSystemPrompt(matrixData, ODRAM_SYSTEM_PROMPT);

        // Step 7: Run each question sequentially against proposal documents
        const questionResults: Record<string, unknown>[] = [];

        for (let qi = 0; qi < matrixData.questions.length; qi++) {
          const question = matrixData.questions[qi];
          const questionNumber = qi + 1;

          await storage.hset(`odram-job:${jobId}`, {
            progress: `Analyzing question ${questionNumber} of ${matrixData.questions.length}: ${question.name}...`,
            currentQuestion: questionNumber,
            totalQuestions: matrixData.questions.length,
            last_updated: Date.now(),
          });

          logger.info('Processing ODRAM question', {
            jobId,
            questionId: question.id,
            questionName: question.name,
          });

          // Find matching team response
          const response = findResponseForQuestion(parsedResponses, question.name);
          const teamRating = response?.teamRating || 'Not provided';
          const teamRationale = response?.teamRationale || 'Not provided';
          const teamMitigation = response?.teamMitigation || 'N/A';

          // Assemble prompt from Prompt Matrix sections
          const assembledPrompt = assembleQuestionPrompt(question, matrixData, {
            teamRating,
            teamRationale,
            teamMitigation,
          });

          const questionDocumentContext = buildDocumentContext(question.id);
          const additionalContext = questionContext?.[question.id]?.trim();

          const fullPrompt = `${assembledPrompt}
${additionalContext ? `\n--- ADDITIONAL CONTEXT FROM REVIEWER ---\n${additionalContext}\n` : ''}
--- ATTACHED DOCUMENTS ---
${questionDocumentContext}

--- OUTPUT FORMAT ---
Return ONLY a JSON object with these fields:
{
  "independentRating": "Low" | "Moderate" | "High" | "N/A",
  "overallAssessment": "One paragraph in third-person voice: the independent assessment, how it compares to the team's, and key gaps or agreements. Do not use first-person (no 'I', 'my', 'our').",
  "keyFeedback": ["1. First actionable observation (max 2 sentences, cite document sections)", "2. ...", ...]
}`;

          try {
            const chatResponse = await completionAdapter.chat({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: fullPrompt },
              ],
            });

            // Parse JSON response
            const text = chatResponse.message.content
              .replace(/^```(?:json)?\n?|\n?```$/g, '')
              .trim();

            let parsed;
            try {
              const json = JSON.parse(text);
              const validated = questionResultSchema.safeParse(json);
              if (validated.success) {
                parsed = validated.data;
              } else {
                logger.warn('ODRAM question Zod validation failed', {
                  jobId,
                  questionId: question.id,
                  error: validated.error.message,
                });
                parsed = json;
              }
            } catch {
              logger.warn('ODRAM question JSON parse failed, using raw text', {
                jobId,
                questionId: question.id,
              });
              parsed = {
                independentRating: 'N/A',
                overallAssessment: text,
                keyFeedback: [],
              };
            }

            const questionResult = {
              questionId: question.id,
              questionName: question.name,
              teamRating,
              ...parsed,
            };
            questionResults.push(questionResult);

            await saveOdramResult({
              jobId,
              questionId: question.id,
              questionName: question.name,
              teamRating,
              independentRating: parsed.independentRating || 'N/A',
              overallAssessment: parsed.overallAssessment || '',
              keyFeedback: JSON.stringify(parsed.keyFeedback || []),
              sortOrder: question.id,
            });
          } catch (questionError) {
            logger.error('Error processing ODRAM question', {
              jobId,
              questionId: question.id,
              error: (questionError as Error).message,
            });

            const errorResult = {
              questionId: question.id,
              questionName: question.name,
              teamRating,
              independentRating: 'N/A',
              overallAssessment: `Error processing this question: ${(questionError as Error).message}`,
              keyFeedback: ['Unable to analyze — see error above.'],
            };
            questionResults.push(errorResult);

            await saveOdramResult({
              jobId,
              questionId: question.id,
              questionName: question.name,
              teamRating,
              independentRating: 'N/A',
              overallAssessment: errorResult.overallAssessment,
              keyFeedback: JSON.stringify(errorResult.keyFeedback),
              sortOrder: question.id,
            });
          }

          // Update partial results in Redis
          await storage.hset(`odram-job:${jobId}`, {
            partialResults: JSON.stringify(questionResults),
            last_updated: Date.now(),
          });

          // Throttle between questions to avoid saturating Bedrock connection limits
          if (qi < matrixData.questions.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        // Step 8: Generate summary
        await storage.hset(`odram-job:${jobId}`, {
          progress: 'Generating overall risk summary...',
          last_updated: Date.now(),
        });

        const summaryPrompt = `You have completed an ODRAM (Opportunity Delivery Risk Assessment Matrix) review of a federal government proposal. Below are the results for all ${matrixData.questions.length} risk questions.

${questionResults.map((r) => `Q${r.questionId} ${r.questionName}: Independent Rating = ${r.independentRating}, Team Rating = ${r.teamRating}`).join('\n')}

Provide a 2-3 paragraph executive summary of the overall risk posture. Highlight:
1. Questions where your independent assessment diverges from the team's rating
2. The highest-risk areas requiring immediate attention
3. Cross-question patterns or inconsistencies
4. An overall recommendation (proceed / proceed with conditions / escalate)

Be concise and direct. Cite specific question numbers.`;

        let summary: string | null = null;
        try {
          const summaryResponse = await completionAdapter.chat({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: summaryPrompt },
            ],
          });
          summary = summaryResponse.message.content;
        } catch (summaryError) {
          logger.error('Error generating ODRAM summary', {
            jobId,
            error: (summaryError as Error).message,
          });
        }

        // Step 9: Store final results
        if (summary) {
          await updateOdramJobSummary(jobId, summary);
        }

        const finalResults = {
          questions: questionResults,
          summary,
        };

        await storage.hset(`odram-job:${jobId}`, {
          status: 'completed',
          progress: 'Analysis complete!',
          results: JSON.stringify(finalResults),
          completed: Date.now(),
          last_updated: Date.now(),
        });
        await updateOdramJobStatus(jobId, 'completed');

        // Clean up S3 files only after the job has fully completed.
        // Deleting earlier would break BullMQ retries (attempts: 3).
        await Promise.all(
          allFileKeys.map((key) => storageProvider.deleteFile(key).catch((e) => {
            logger.warn('Failed to delete S3 file', { key, error: (e as Error).message });
          })),
        );

        logger.info('ODRAM analysis complete', {
          jobId,
          questionCount: questionResults.length,
          hasSummary: summary !== null,
        });

        return finalResults;
      } catch (error) {
        logger.error('Error in ODRAM worker:', error);

        await storage.hset(`odram-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          completed: Date.now(),
          last_updated: Date.now(),
        });

        try {
          await updateOdramJobStatus(jobId, 'error');
        } catch (dbError) {
          logger.error('Failed to update ODRAM job status in DB after error:', dbError);
        }

        throw error;
      }
    },
    {
      connection,
      lockDuration: 600000, // 10 minutes — ODRAM runs 26+ LLM calls
      concurrency: DEFAULT_WORKER_CONFIG.concurrency,
      limiter: DEFAULT_WORKER_CONFIG.limiter,
      stalledInterval: 300000, // 5 minutes
      maxStalledCount: DEFAULT_WORKER_CONFIG.maxStalledCount,
    },
  );

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
};
