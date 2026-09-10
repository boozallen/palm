import { registerMetric, unregisterMetric, getMetric, listMetrics, runMetric } from '@/features/eval/services/metricRegistry';
import { type EvalMetric, type EvalMetricContext } from '@/features/eval/types/metric';

const baseContext: EvalMetricContext = {
  targetType: 'prompt',
  targetId: 'prompt-1',
  targetVersion: '1',
  provider: 'anthropic',
  model: 'claude-sonnet',
  input: 'question',
  output: 'answer',
};

function buildMetric(name: string, score = 100): EvalMetric {
  return {
    name,
    evaluate: jest.fn().mockResolvedValue({ score }),
  };
}

describe('metricRegistry', () => {
  afterEach(() => {
    listMetrics().forEach((metric) => unregisterMetric(metric.name));
  });

  it('registers and retrieves a metric by name', () => {
    const metric = buildMetric('schema-validation');
    registerMetric(metric);

    expect(getMetric('schema-validation')).toBe(metric);
    expect(listMetrics()).toContain(metric);
  });

  it('throws when registering a duplicate metric name', () => {
    registerMetric(buildMetric('llm-judge'));

    expect(() => registerMetric(buildMetric('llm-judge'))).toThrow('Eval metric already registered: llm-judge');
  });

  it('runs a registered metric against a context and returns its result', async () => {
    const metric = buildMetric('citation-accuracy', 87);
    registerMetric(metric);

    const result = await runMetric('citation-accuracy', baseContext);

    expect(metric.evaluate).toHaveBeenCalledWith(baseContext);
    expect(result).toEqual({ score: 87 });
  });

  it('throws when running an unknown metric', async () => {
    await expect(runMetric('does-not-exist', baseContext)).rejects.toThrow('Unknown eval metric: does-not-exist');
  });

  it('unregisters a metric so it is no longer retrievable', () => {
    registerMetric(buildMetric('temp-metric'));
    unregisterMetric('temp-metric');

    expect(getMetric('temp-metric')).toBeUndefined();
  });
});
