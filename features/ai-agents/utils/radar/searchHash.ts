import crypto from 'crypto';

export type SearchParameters = {
  dateStart: string;
  dateEnd: string;
  categories: string[];
  institutions: string[];
};

/**
 * Normalizes and sorts an array of strings for consistent hashing
 * - Trims whitespace
 * - Converts to lowercase  
 * - Sorts alphabetically
 */
function normalizeAndSort(items: string[]): string[] {
  return items
    .map(item => item.trim().toLowerCase())
    .filter(item => item.length > 0) 
    .sort();
}

/**
 * Generates a SHA256 hash from search parameters for result caching
 * Ensures same parameters produce same hash regardless of order or casing
 */
export function generateSearchHash(params: SearchParameters): string {
  const { dateStart, dateEnd, categories, institutions } = params;
  
  // Normalize and sort arrays to ensure consistent hashing
  const normalizedCategories = normalizeAndSort(categories);
  const normalizedInstitutions = normalizeAndSort(institutions);
  
  // Create a consistent string representation
  const hashInput = [
    `dateStart:${dateStart.trim()}`,
    `dateEnd:${dateEnd.trim()}`,
    `categories:${normalizedCategories.join(',')}`,
    `institutions:${normalizedInstitutions.join(',')}`,
  ].join('|');
  
  // Generate SHA256 hash
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Generates a cache key for storing/retrieving research results
 */
export function generateCacheKey(searchHash: string): string {
  return `research-cache:${searchHash}`;
}

/**
 * Generates a key for tracking active jobs with the same search parameters
 */
export function generateActiveJobKey(searchHash: string): string {
  return `research-active:${searchHash}`;
}
