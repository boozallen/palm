/**
 * Raised when a provider is given a second embeddings-only model. Carries the
 * name of the model that already holds the designation, because that is the only
 * thing that tells an admin which row to delete first.
 *
 * The class exists so the DAL can re-throw on `instanceof` rather than matching
 * its own message text. It does NOT survive the tRPC boundary — errors are
 * serialized, so the class identity is lost by the time the client sees one.
 * The route translates it into a CONFLICT TRPCError, and the client keys on that
 * code; see isDuplicateEmbeddingsModelError in AddModelForm.
 */
export class DuplicateEmbeddingsModelError extends Error {
  constructor(public existingModelName: string) {
    super(
      `This provider already uses "${existingModelName}" for embeddings. Delete that model first.`,
    );
    this.name = 'DuplicateEmbeddingsModelError';
  }
}
