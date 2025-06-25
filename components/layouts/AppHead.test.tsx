import { render } from '@testing-library/react';
import AppHead from './AppHead';
import { useRouter } from 'next/router';
import React from 'react';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
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

  beforeEach(() => {
    capturedTitle = '';
    capturedMeta = '';
    jest.clearAllMocks();
  });

  const testCases = [
    { path: '/chat', expectedTitle: 'New Chat', query: {} },
    { path: '/chat/[chatid]', expectedTitle: 'Chat', query: { chatId: '123' } },
    { path: '/chat/[chatid]/[promptslug]', expectedTitle: 'Chat - Test Prompt', query: { chatId: '123', promptSlug: 'test-prompt' } },
    { path: '/library', expectedTitle: 'Prompt Library', query: {} },
    { path: '/library/[slug]/[promptid]', expectedTitle: 'Prompt - Test Slug', query: { slug: 'test-slug', promptSlug: 'test-slug' } },
    { path: '/library/[slug]/[promptid]/edit', expectedTitle: 'Edit Prompt - Test Slug', query: { slug: 'test-slug', promptSlug: 'test-slug' } },
    { path: '/library/add', expectedTitle: 'Add Prompt', query: {} },
    { path: '/prompt-generator', expectedTitle: 'Prompt Generator', query: {} },
    { path: '/prompt-playground', expectedTitle: 'Prompt Playground', query: {} },
    { path: '/ai-agents', expectedTitle: 'AI Agents', query: {} },
    { path: '/ai-agents/[agentslug]', expectedTitle: 'AI Agent - Test Agent', query: { agentSlug: 'test-agent' } },
    { path: '/settings', expectedTitle: 'Settings', query: {} },
    { path: '/settings/user-groups/[id]', expectedTitle: 'User Group', query: { id: '456' } },
    { path: '/analytics', expectedTitle: 'Analytics', query: {} },
    { path: '/profile', expectedTitle: 'Profile', query: {} },
    { path: '/legal', expectedTitle: 'Legal Policies', query: {} },
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
});
