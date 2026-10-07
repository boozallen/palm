import logger from '@/server/logger';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { AiFactoryEmbeddingsAdapter } from '@/features/ai-agents/utils/aiFactoryEmbeddingsAdapter';
import { QueryEngine, Document } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import { TextChunker, TextNode } from '@/features/ai-agents/utils/textChunker';
import { VectorStore } from '@/features/ai-agents/utils/vectorStore';
import { parseComplianceResponse } from '@/features/ai-agents/utils/certa/resultParser';

export interface QueryResponse {
  response: string;
  sourceNodes?: TextNode[];
  toString(): string;
  parsedResult?: ReturnType<typeof parseComplianceResponse>;
}

export class QueryEngineManager implements QueryEngine {
  private readonly vectorStore = new VectorStore();
  private readonly textChunker: TextChunker;
  private readonly completionAdapter: AiFactoryCompletionAdapter;
  private readonly embeddingsAdapter: AiFactoryEmbeddingsAdapter;

  constructor(
    completionAdapter: AiFactoryCompletionAdapter,
    embeddingsAdapter: AiFactoryEmbeddingsAdapter,
    chunkSize = 512,
    chunkOverlap = 150
  ) {
    this.completionAdapter = completionAdapter;
    this.embeddingsAdapter = embeddingsAdapter;
    this.textChunker = new TextChunker(chunkSize, chunkOverlap);
  }

  async addDocuments(documents: Document[], batchSize = 5): Promise<void> {
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const nodes: TextNode[] = batch.flatMap((doc) =>
        this.textChunker.processDocument(doc)
      );

      if (nodes.length === 0) {
        continue;
      }

      const texts = nodes.map((n) => n.text);
      const embeddings = await this.embeddingsAdapter.getEmbeddings(texts);

      logger.debug(`Adding ${nodes.length} documents to the vector store...`);

      nodes.forEach((node, idx) => {
        node.embedding = embeddings[idx];
        this.vectorStore.addNode(node);
      });

      logger.debug(
        `Added ${nodes.length} documents to the vector store. Total nodes: ${this.vectorStore.getStats().totalNodes}`
      );
    }
  }

  async runQuery(query: string): Promise<QueryResponse> {
    const embedding = await this.embeddingsAdapter.getQueryEmbedding(query);
    const similarNodes = this.vectorStore.findSimilarNodes(
      embedding,
      query,
      20
    );

    const legalChunks = similarNodes.filter((n) =>
      ['legal-block', 'likely-footer', 'nav-block'].includes(
        n.metadata?.semanticSource ?? ''
      )
    );

    const others = similarNodes.filter(
      (n) =>
        !['legal-block', 'likely-footer', 'nav-block'].includes(
          n.metadata?.semanticSource ?? ''
        )
    );

    const selectedChunks = [...legalChunks, ...others]
      .filter((n) => n.text && n.text.length > 30)
      .slice(0, 10);

    if (selectedChunks.length === 0) {
      const responseText =
        ' The website does not contain sufficient content to evaluate compliance with the policy requirements.';
      return {
        response: responseText,
        sourceNodes: [],
        toString: () => responseText,
        parsedResult: undefined,
      };
    }

    const websiteContent = this.constructContent(selectedChunks);
    const modifiedQuery = this.injectContentIntoPrompt(query, websiteContent);

    const completion = await this.completionAdapter.complete({
      prompt: modifiedQuery,
    });
    const responseText = completion.text.trim();
   
    let parsedResult: ReturnType<typeof parseComplianceResponse> | undefined;

    try {
      parsedResult = parseComplianceResponse(responseText);
    } catch (err) {
      logger.warn('[Parsing Error] Could not parse compliance response:', err);
    }

    return {
      response: responseText,
      sourceNodes: selectedChunks,
      toString: () => responseText,
      parsedResult,
    };
  }

  private constructContent(nodes: TextNode[]): string {
    return nodes
      .map((node, idx) => {
        const sourceInfo = node.metadata?.url
          ? `Source: ${node.metadata.url}`
          : '';
        const header = `DOCUMENT ${idx + 1}:\n${sourceInfo}`.trim();
        const body = node.text.trim();
        return `${header}\n\n${body}`;
      })
      .join('\n\n---\n\n');
  }

  private injectContentIntoPrompt(prompt: string, content: string): string {
    let result = prompt;
    if (result.includes('Input Data:')) {
      const idx = result.indexOf('Input Data:');
      const polIdx = result.indexOf('POLICY:', idx);
      if (polIdx > idx) {
        result =
          result.slice(0, polIdx) +
          'WEBSITE CONTENT:\n\n' +
          content +
          '\n\n' +
          result.slice(polIdx);
      } else {
        result = result.replace(
          'Input Data:',
          'Input Data:\nWEBSITE CONTENT:\n\n' + content + '\n\n'
        );
      }
    } else {
      result = 'WEBSITE CONTENT:\n\n' + content + '\n\n' + result;
    }

    return (
      result +
      '\n\nIMPORTANT: You MUST check every part of the provided WEBSITE CONTENT thoroughly before determining if something is present or not. Pay special attention to:\n1. Navigation areas\n2. Footer content\n3. Link texts and URLs\n4. Headers and page structure'
    );
  }
}
