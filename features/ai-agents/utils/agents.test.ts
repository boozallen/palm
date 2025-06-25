import { generateAgentSlug, generateAgentUrl } from './agents';
import { AgentType } from '@/features/shared/types';

describe('generateAgentSlug', () => {
  it('should generate the correct slug', () => {
    const title = AgentType.CERTA;
    const slug = generateAgentSlug(title);
    expect(slug).toBe('compliance-evaluation-reporting-and-tracking-agent-certa');
  });
});

describe('generateAgentUrl', () => {
  it('should generate the correct url', () => {
    const title = AgentType.CERTA;
    const url = generateAgentUrl(title);
    expect(url).toBe('/ai-agents/compliance-evaluation-reporting-and-tracking-agent-certa');
  });
});
