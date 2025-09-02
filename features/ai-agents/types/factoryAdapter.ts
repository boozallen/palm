import { AIFactory } from '@/features/ai-provider';

export type BuildResult = Awaited<ReturnType<AIFactory['buildUserSource']>>;
