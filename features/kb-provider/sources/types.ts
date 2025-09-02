export type SearchInput = {
  message: string,
  knowledgeBaseId: string,
  maxResults: number,
  minScore?: number,
}

export type SearchResult = {
  content: string,
  score: number,
  citation?: {
    label: string,
    knowledgeBaseId: string,
  },
}

export type SearchResponse = {
  results: SearchResult[],
}

export interface KbSource {
  search(input: SearchInput): Promise<SearchResponse>
}
