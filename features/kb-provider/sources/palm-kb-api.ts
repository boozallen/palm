import axios from 'axios';
import z from 'zod';
import { KbSource, SearchInput, SearchResponse } from '.';
import { KbProviderPalmConfigSchema } from '@/features/shared/types';

type KbProviderPalmConfig = z.infer<typeof KbProviderPalmConfigSchema>;

const SearchResponseSchema = z.object({
  totalResults: z.number(),
  results: z.array(
    z.object({
      content: z.string(),
      score: z.number(),
      citation: z.object({
        documentId: z.string(),
        name: z.string(),
        filename: z.string(),
      }).optional(),
    }),
  ),
});

export class PalmKbApiSource implements KbSource {
  constructor(protected config: KbProviderPalmConfig) { };
  async search(input: SearchInput): Promise<SearchResponse> {
    const url = `${this.config.apiEndpoint}/api/v1/knowledgebases/${input.knowledgeBaseId}/search`;
    const headers = { Authorization: `Bearer ${this.config.apiKey}` };
    const params = {
      query: input.message,
      numberResults: input.maxResults,
      documentId: null,
    };
    const { data } = await axios.get(url, { headers, params });
    const { results } = SearchResponseSchema.parse(data);

    // Format the citations
    const formattedResults = results.map(({ content, score, citation }) => {
      let formattedCitation;
      if (citation) {
        formattedCitation = {
          label: citation.name,
          knowledgeBaseId: input.knowledgeBaseId,
        };
      }
      return { content, score, citation: formattedCitation };
    });

    return {
      results: formattedResults,
    };
  }
}
