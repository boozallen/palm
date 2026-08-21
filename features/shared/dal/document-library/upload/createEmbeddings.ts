import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import db from '@/server/db';
import { TextChunk, EmbeddingResponse } from '@/features/document-upload-provider/sources/types';
import logger from '@/server/logger';

type CreateEmbeddingsInput = {
  embeddings: EmbeddingResponse[],
  chunks: TextChunk[],
  documentId: string,
}

export default async function createEmbeddings({
  embeddings,
  chunks,
  documentId,
}: CreateEmbeddingsInput) {
  return await db.$transaction(async (tx) => {
    try {
      if (embeddings.length === 0) {
        return { count: 0 };
      }

      for (let i = 0; i < embeddings.length; i++) {
        if (!embeddings[i].embedding.every((val) => typeof val === 'number' && !isNaN(val))) {
          throw new Error(`Invalid embedding values detected at index ${i}`);
        }
      }

      const values = embeddings.map((emb, i) => {
        const id = randomUUID();
        const vectorString = `[${emb.embedding.join(',')}]`;
        const { content, index: contentNum, startPosition, endPosition } = chunks[i];

        return Prisma.sql`(${Prisma.sql`${id}::uuid`}, ${Prisma.sql`${vectorString}::vector`}, ${content}, ${contentNum}, ${startPosition}, ${endPosition}, ${Prisma.sql`${documentId}::uuid`})`;
      });

      const insertQuery = Prisma.sql`
        INSERT INTO "Embedding" ("id", "embedding", "content", "contentNum", "startPosition", "endPosition", "documentId")
        VALUES ${Prisma.join(values, ', ')}
      `;

      await tx.$executeRaw(insertQuery);

      logger.info(`Successfully inserted ${embeddings.length} embeddings for document ${documentId}`);

      return { count: embeddings.length };
    } catch (error) {
      logger.error(`There was a problem creating embeddings for document ${documentId}`, error);
      throw new Error('There was a problem creating the embeddings');
    }
  }, {
    timeout: 60000,
  });
}
