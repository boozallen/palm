import React from 'react';
import { render, screen } from '@testing-library/react';
import KbProvidersTable from './KbProvidersTable';
import { KbProviderType } from '@/features/shared/types';

jest.mock('@/features/settings/api/get-kb-providers', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/settings/api/get-knowledge-bases', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./KbProviderRow', () => (function MockKbProviderRow() {
  return <tr><td>KB Provider Row</td></tr>;
}));

jest.mock('./KnowledgeBaseRow', () => (function MockKnowledgeBaseRow() {
  return <tr><td>Knowledge Base Row</td></tr>;
}));

describe('KbProvidersTable', () => {
  const mockKbProviders = {
    kbProviders: [
      {
        id: 'b9cb9ced-ab50-4534-9444-710112b7e178',
        label: 'PALM Provider',
        config: {
          apiEndpoint: 'test endpoint',
        },
        kbProviderType: KbProviderType.KbProviderPalm,
        createdAt: '2021-07-13T12:34:56.000Z',
        updatedAt: '2021-07-13T12:34:56.000Z',
      },
    ],
  };

  const mockKnowledgeBases = {
    knowledgeBases: [
      {
        id: 'e9cb9ced-ab50-4534-9444-710112b7e178',
        label: 'PALM Knowledge Base 1',
        externalId: '12345',
        kbProviderId: 'b9cb9ced-ab50-4534-9444-710112b7e178',
        createdAt: '2021-07-13T12:34:56.000Z',
        updatedAt: '2021-07-13T12:34:56.000Z',
      },
      {
        id: 'f9cb9ced-ab50-4534-9444-710112b7e178',
        label: 'PALM Knowledge Base 2',
        externalId: '67890',
        kbProviderId: 'b9cb9ced-ab50-4534-9444-710112b7e178',
        createdAt: '2021-07-13T12:34:56.000Z',
        updatedAt: '2021-07-13T12:34:56.000Z',
      },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();

    require('@/features/settings/api/get-kb-providers').default.mockReturnValue({
      data: mockKbProviders,
      isPending: false,
      error: null,
    });

    require('@/features/settings/api/get-knowledge-bases').default.mockReturnValue({
      data: mockKnowledgeBases,
      isPending: false,
      error: null,
    });
  });

  it('should render table headers', () => {
    render(<KbProvidersTable />);
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Base Name')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Base External ID')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should render correct number of provider rows', () => {
    render(<KbProvidersTable />);
    expect(screen.getAllByText('KB Provider Row')).toHaveLength(mockKbProviders.kbProviders.length);
  });

  it('should render correct number of knowledge base rows', () => {
    render(<KbProvidersTable />);
    expect(screen.getAllByText('Knowledge Base Row')).toHaveLength(mockKnowledgeBases.knowledgeBases.length);
  });

  it('should render text when no providers are configured', () => {
    require('@/features/settings/api/get-kb-providers').default.mockReturnValue({
      data: { kbProviders: [] },
      isPending: false,
      error: null,
    });

    render(<KbProvidersTable />);
    expect(screen.getByText('No Knowledge Base Providers have been configured yet.')).toBeInTheDocument();
  });
});
