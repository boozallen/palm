import type { PulseOutputKind } from '@/features/ai-agents/types/pulse/results';

// The three downloadable files. The narrative is text inside them, not one of them.
export const PULSE_OUTPUT_FILE_KINDS: PulseOutputKind[] = ['dashboard', 'pdf', 'slides'];

// Why a results output isn't downloadable. Kept out of the route so client code can read them
// without pulling the server logger into the browser bundle.
export const LEGACY_OUTPUT_REASON = 'Outputs weren\'t generated for runs before this update.';
export const FAILED_RUN_OUTPUT_REASON = 'The run failed before the results outputs were built.';
export const PROCESSING_OUTPUT_REASON = 'The results outputs are built when the run finishes.';
