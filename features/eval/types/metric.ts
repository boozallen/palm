export type EvalTargetType = 'prompt' | 'agent';

/** Normalized inputs a metric may need. Individual metrics read only the fields they require. */
export type EvalMetricContext = {
  targetType: EvalTargetType;
  targetId: string;
  targetVersion: string;
  provider: string;
  model: string;
  input: unknown;
  output: unknown;
  expectedOutputSchema?: unknown;
  kbContextChunks?: { sourceId: string; text: string }[];
  citations?: { sourceId: string }[];
};

export type EvalMetricResult = {
  score: number;
  pass?: boolean;
  rationale?: string;
  metadata?: Record<string, unknown>;
};

/** Implement this interface and register the instance with the metric registry to add a new eval metric. */
export type EvalMetric = {
  name: string;
  evaluate(context: EvalMetricContext): Promise<EvalMetricResult>;
};
