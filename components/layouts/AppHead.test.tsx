
import { render } from '@testing-library/react';
import AppHead from './AppHead';
import { useRouter } from 'next/router';
import useGetUserGroup from '@/features/settings/api/user-groups/get-user-group';
import React from 'react';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/settings/api/user-groups/get-user-group', () => ({
  __esModule: true,
  default: jest.fn(),
}));

let capturedTitle = '';
let capturedMeta = '';

jest.mock('next/head', () => {
  return function MockHead(props: { children: any; }) {
    capturedTitle = '';
    capturedMeta = '';
    
    React.Children.forEach(props.children, child => {
      if (!child) {return;}
      
      if (child.type === 'title') {
        capturedTitle = child.props.children;
      }
      
      if (child.type === 'meta' && child.props.name === 'description') {
        capturedMeta = child.props.content;
      }
    });
    
    return null;
  };
});

describe('AppHead', () => {
  const mockUseRouter = useRouter as jest.Mock;
  const mockUseGetUserGroup = useGetUserGroup as jest.Mock;

  beforeEach(() => {
    capturedTitle = '';
    capturedMeta = '';
    jest.clearAllMocks();
    mockUseGetUserGroup.mockReturnValue({ data: undefined });
  });

  const testCases = [
    { path: '/chat', expectedTitle: 'New Chat', query: {} },
    { path: '/chat/[chatid]', expectedTitle: 'Chat', query: { chatId: '123' } },
    { path: '/chat/[chatid]/[promptslug]', expectedTitle: 'Chat - Test Prompt', query: { chatId: '123', promptSlug: 'test-prompt' } },
    { path: '/library', expectedTitle: 'Prompt Library', query: {} },
    { path: '/library/[slug]/[promptid]', expectedTitle: 'Prompt - Test Slug', query: { slug: 'test-slug' } },
    { path: '/library/[slug]/[promptid]/edit', expectedTitle: 'Edit Prompt - Test Slug', query: { slug: 'test-slug' } },
    { path: '/library/add', expectedTitle: 'Add Prompt', query: {} },
    { path: '/prompt-generator', expectedTitle: 'Prompt Generator', query: {} },
    { path: '/prompt-playground', expectedTitle: 'Prompt Playground', query: {} },
    { path: '/ai-agents', expectedTitle: 'AI Agents', query: {} },
    { path: '/ai-agents/[agentslug]/[agentid]', expectedTitle: 'AI Agent - Test Agent', query: { agentSlug: 'test-agent' } },
    { path: '/workflows', expectedTitle: 'Workflows', query: {} },
    { path: '/workflows/create', expectedTitle: 'Create Workflow', query: {} },
    { path: '/workflows/[slug]/[workflowid]', expectedTitle: 'Workflow - Test Workflow', query: { slug: 'test-workflow', workflowId: '123' } },
    { path: '/workflows/[slug]/view/[executionid]/[primitiveid]', expectedTitle: 'Workflow - Test Workflow - View artifact', query: { slug: 'test-workflow', executionId: 'exec-123', primitiveId: 'prim-456' } },
    { path: '/settings', expectedTitle: 'Settings', query: {} },
    { path: '/settings/user-groups/[id]', expectedTitle: 'User Group', query: { id: '456' } },
    { path: '/settings/ai-agents/[id]', expectedTitle: 'AI Agent - Configuration', query: { id: '789' } },
    { path: '/context-studio', expectedTitle: 'Context Studio', query: {} },
    { path: '/profile', expectedTitle: 'Profile', query: {} },
    { path: '/legal', expectedTitle: 'Legal Policies', query: {} },
    { path: '/settings/databases/neo4j', expectedTitle: 'Neo4j Knowledge Graph Database', query: {} },
    { path: '/settings/databases/postgres', expectedTitle: 'PostgreSQL Database', query: {} },
    { path: '/', expectedTitle: 'Prompt & Agent Library Marketplace (PALM)', query: {} }, // Default case
  ];

  testCases.forEach(({ path, expectedTitle, query }) => {
    it(`should set the document title to "${expectedTitle}" for path "${path}"`, () => {
      mockUseRouter.mockReturnValue({ pathname: path, query });
      
      render(<AppHead />);
     
      expect(capturedTitle).toBe(expectedTitle);
    });

    it(`should include a meta description for path "${path}"`, () => {
      mockUseRouter.mockReturnValue({ pathname: path, query });

      render(<AppHead />);

      expect(capturedMeta).toBeTruthy();
      expect(capturedMeta.length).toBeGreaterThan(0);
    });
  });

  it('should include the user group label in the title once it loads', () => {
    mockUseRouter.mockReturnValue({ pathname: '/settings/user-groups/[id]', query: { id: '456' } });
    mockUseGetUserGroup.mockReturnValue({ data: { label: 'Test Group #1' } });

    render(<AppHead />);

    expect(capturedTitle).toBe('User Group - Test Group #1');
  });
});
