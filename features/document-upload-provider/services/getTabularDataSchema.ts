import { logger } from '@/server/logger';
import { getConfig } from '@/server/config';
import { DataProfile } from '@/features/shared/types/document';

export async function getTabularDataSchema(documentId: string, fileName: string, fileData: Buffer): Promise<Pick<DataProfile, 'sheets'> | null> {
  const { claudeServiceUrl, internalApiKey } = getConfig().agentServices;
  try {
    const response = await fetch(`${claudeServiceUrl}/get-schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalApiKey}`,
      },
      body: JSON.stringify({
        data_b64: fileData.toString('base64'),
        filename: fileName,
      }),
    });

    if (!response.ok) {
      logger.warn(`[DOC-UPLOAD] get-schema failed for ${documentId}: HTTP ${response.status}`);
      return null;
    }

    const result = await response.json() as { success: boolean; profile?: Pick<DataProfile, 'sheets'>; error?: string };
    if (!result.success) {
      logger.warn(`[DOC-UPLOAD] get-schema error for ${documentId}: ${result.error}`);
      return null;
    }

    logger.info(`[DOC-UPLOAD] data schema fetched for ${documentId}`);
    return result.profile ?? null;
  } catch (error) {
    logger.warn(`[DOC-UPLOAD] get-schema threw for ${documentId}:`, error);
    return null;
  }
}
