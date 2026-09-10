import { type EvalMetric, type EvalMetricContext, type EvalMetricResult } from '@/features/eval/types/metric';

const metrics = new Map<string, EvalMetric>();

/** Registers a metric so it can be run by name. Throws on duplicate names to catch registration bugs early. */
export function registerMetric(metric: EvalMetric): void {
  if (metrics.has(metric.name)) {
    throw new Error(`Eval metric already registered: ${metric.name}`);
  }
  metrics.set(metric.name, metric);
}

export function unregisterMetric(name: string): void {
  metrics.delete(name);
}

export function getMetric(name: string): EvalMetric | undefined {
  return metrics.get(name);
}

export function listMetrics(): EvalMetric[] {
  return Array.from(metrics.values());
}

export async function runMetric(name: string, context: EvalMetricContext): Promise<EvalMetricResult> {
  const metric = metrics.get(name);
  if (!metric) {
    throw new Error(`Unknown eval metric: ${name}`);
  }
  return metric.evaluate(context);
}
