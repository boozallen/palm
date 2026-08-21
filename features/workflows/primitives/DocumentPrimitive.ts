/**
 * Document Input Primitive
 * Documents are configured at workflow creation time (selected from library or uploaded).
 * At execution time this primitive loads them and passes them into the workflow context.
 */

import { BasePrimitive } from '@/features/workflows/primitives/BasePrimitive';
import {
  PrimitiveContext,
  PrimitiveResult,
  PrimitiveType,
  DocumentConfig,
} from '@/features/workflows/types/primitive';
import logger from '@/server/logger';
import db from '@/server/db';

export class DocumentPrimitive extends BasePrimitive {
  private readonly documentConfig: DocumentConfig;

  constructor(config: any) {
    super({ ...config, type: PrimitiveType.DOCUMENT });
    this.documentConfig = (config.config || {}) as DocumentConfig;
  }

  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    const base = await super.validate();
    const errors = base.errors || [];

    const hasDocument = Boolean(this.documentConfig.documentId);

    if (!hasDocument) {
      errors.push('Document Input requires a document. Configure this step to select a document.');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_context: PrimitiveContext): Promise<PrimitiveResult> {
    const { documentId } = this.documentConfig;

    if (!documentId) {
      return this.error('No document configured for this input.');
    }

    // Fetch document filename from database
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, filename: true },
    });

    if (!document) {
      return this.error(`Document ${documentId} not found.`);
    }

    logger.info('Loaded document reference', { documentId, filename: document.filename });

    return this.success(
      {
        documents: [{ id: document.id, name: document.filename }],
      },
      { documentId, documentName: document.filename },
    );
  }
}
