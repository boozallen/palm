import crypto from 'crypto';

/**
 * Helper to generate the object key for cloud service storage.
 * @param userId - The user's ID
 * @param fileName - The document's filename
 * @returns The cloud storage object key/path
 */

export function generateObjectKey(userId: string, salt: string, fileName: string): string {
  const hash = crypto.createHmac('sha256', salt)
    .update(userId)
    .digest('hex');
  return `document-upload/users/${hash}/${fileName}`;
};
