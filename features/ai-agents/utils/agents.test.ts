import { generateAgentSlug, generateAgentUrlOld, generateAgentUrl } from './agents';
import { AiAgentLabels, AiAgentType } from '@/features/shared/types';

jest.mock('@/libs/featureFlags');

describe('generateAgentSlug', () => {
  it('should generate the correct slug', () => {
    const title = AiAgentLabels[AiAgentType.CERTA];
    const slug = generateAgentSlug(title);
    expect(slug).toBe('compliance-evaluation-reporting-and-tracking-agent-certa');
  });
});

describe('generateAgentUrlOld', () => {
  it('should generate the correct url with slug', () => {
    const title = AiAgentLabels[AiAgentType.CERTA];

    const url = generateAgentUrlOld(title);
    expect(url).toBe('/ai-agents/compliance-evaluation-reporting-and-tracking-agent-certa');
  });
});

describe('generateAgentUrl', () => {
  it('should generate the correct url with slug and id', () => {
    const title = AiAgentLabels[AiAgentType.CERTA];
    const id = '123456-abcdef-123456-abcdef';
    const url = generateAgentUrl(title, id);
    expect(url).toBe('/ai-agents/compliance-evaluation-reporting-and-tracking-agent-certa/123456-abcdef-123456-abcdef');
  });
});
