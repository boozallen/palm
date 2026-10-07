/**
 * Compute intersection of two arrays
 * Used for alias overlap calculation
 *
 * Example:
 *   intersection(['DHA', 'agency'], ['DHA', 'Defense']) => ['DHA']
 */
export function intersection<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter(x => setB.has(x));
}

/**
 * NOTE: No manual cosineSimilarity() function needed!
 *
 * pgvector's <=> operator computes cosine distance efficiently in the database:
 *   cosine_similarity = 1 - (vector1 <=> vector2)
 *
 * This function would only be needed if comparing vectors outside of the database
 * (e.g., for testing with mock vectors).
 *
 * For production: ALWAYS use pgvector query result, not manual computation.
 */
