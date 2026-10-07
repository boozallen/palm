import { PolicyResults, QueryEngine, PromptManager } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import { parseComplianceResponse } from '@/features/ai-agents/utils/certa/resultParser';
import logger from '@/server/logger';

/**
 * QueryResponse represents the response from an AI query.
 */
export interface QueryResponse {
  response: string;
  sourceNodes?: any[];
  toString(): string;
}

/**
 * ComplianceChecker is responsible for evaluating web content against specified policies
 * using AI-driven compliance assessment and text embeddings.
 */
export class ComplianceChecker {
  /**
   * Initializes a ComplianceChecker instance with necessary dependencies.
   * @param promptManager - Manages prompts for compliance and consensus queries.
   * @param queryEngine - Executes AI-driven queries for compliance evaluation.
   */
  constructor(
    private readonly promptManager: PromptManager,
    private readonly queryEngine: QueryEngine,
  ) { }

  /**
   * Conducts a compliance check for a specified policy by executing multiple AI queries
   * and generating a consensus response to enhance reliability.
   *
   * The method fetches compliance and consensus prompts from the prompt manager,
   * executes queries using the query engine, and processes the results to determine compliance.
   *
   * @param policyTitle - Title of the policy to check compliance against.
   */
  async checkSinglePolicy(
    policyTitle: string,
  ): Promise<PolicyResults[string]> {
    logger.debug(
      `Starting compliance check for policy: ${policyTitle}`
    );

    try {
      // Retrieve the compliance prompt from the prompt manager
      const complianceQuery = await this.promptManager.getCompliancePrompt();

      let responses: QueryResponse[] = [];

      // Execute the compliance query multiple times to gather diverse responses
      try {
        responses = await Promise.all([
          this.queryEngine.runQuery(complianceQuery),
          this.queryEngine.runQuery(complianceQuery),
          this.queryEngine.runQuery(complianceQuery),
        ]);
      } catch (error) {
        logger.error(`There was an error running the complianceQuery: ${policyTitle}`, error);
        throw new Error('There was an error querying the vector store');
      }

      // Generate a consensus query based on the responses
      const consensusQuery = await this.promptManager.getConsensusPrompt(
        responses[0].toString(),
        responses[1].toString(),
        responses[2].toString(),
      );

      // Execute the consensus query
      let consensusResponse: QueryResponse;
      try {
        consensusResponse = await this.queryEngine.runQuery(consensusQuery);
      } catch (error) {
        logger.error(`There was an error running the consensusQuery: ${policyTitle}`, error);
        throw new Error('There was an error querying the vector store');
      }

      // Parse the consensus response to derive compliance results
      const result = parseComplianceResponse(consensusResponse.toString());

      logger.debug(`Compliance check completed for policy: ${policyTitle}`);
      return { isLoading: false, result };
    } catch (error) {
      logger.error(`Error during compliance check for policy: ${policyTitle}`, error);
      return { isLoading: false };
    }
  }
}
