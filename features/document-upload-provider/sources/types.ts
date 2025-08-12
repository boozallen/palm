export type EmbeddingResponse = {
  embedding: number[]
}

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
}

export interface StorageProvider {
  generatePresignedUploadUrl(
    fileName: string,
    contentType: string,
    userId: string
  ): Promise<{ presignedUrl: string; fileKey: string }>;

  generateDownloadUrl(fileKey: string): Promise<string>;

  fetchFile(fileKey: string): Promise<Buffer>;

  deleteFile(fileKey: string): Promise<void>;
}
