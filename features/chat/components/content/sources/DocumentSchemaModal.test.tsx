import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';

import DocumentSchemaModal from './DocumentSchemaModal';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useGetGraphedDocuments } from '@/features/graph-database/api/get-graphed-documents';
import { useGetActiveGraphBuilds } from '@/features/graph-database/api/get-active-graph-builds';
import { useGetUserProvidedGraphDocuments } from '@/features/graph-database/api/get-user-provided-graph-documents';
import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@/features/shared/api/document-upload/get-documents');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/graph-database/api/get-graphed-documents');
jest.mock('@/features/graph-database/api/get-active-graph-builds');
jest.mock('@/features/graph-database/api/get-user-provided-graph-documents');
jest.mock('@/features/shared/api/document-collections/use-get-collections');
jest.mock('@/features/shared/components/document-library/modals/ManageDocumentCollectionsModal', () => ({
  __esModule: true,
  default: ({ modalOpened, documentFilename }: { modalOpened: boolean; documentFilename: string }) =>
    modalOpened ? <div data-testid='manage-collections-modal'>{documentFilename}</div> : null,
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

const renderModal = () =>
  render(
    <MantineProvider>
      <DocumentSchemaModal opened onClose={jest.fn()} />
    </MantineProvider>
  );

describe('DocumentSchemaModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { documentLibraryDocumentUploadProviderId: 'test-provider' },
    });
    (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: [] });
    (useGetUserProvidedGraphDocuments as jest.Mock).mockReturnValue({ data: { userProvidedDocumentIds: [] } });
    (useGetCollections as jest.Mock).mockReturnValue({ data: { collections: [] } });
    (useGetGraphedDocuments as jest.Mock).mockReturnValue({
      data: { documentIds: [], ungraphableDocumentIds: [], documentSchemas: {} },
    });
    (useGetDocuments as jest.Mock).mockReturnValue({
      data: {
        documents: [
          {
            id: 'doc-soo',
            filename: 'solicitation.pdf',
            uploadStatus: DocumentUploadStatus.Completed,
            dataProfile: { type: 'SOO' },
          },
        ],
      },
    });
  });

  it('shows an Extraction build type by default', async () => {
    renderModal();

    expect(await screen.findByTestId('build-type-doc-soo')).toHaveTextContent('Extraction');
  });

  it('shows a User-provided build type for user-provided documents', async () => {
    (useGetUserProvidedGraphDocuments as jest.Mock).mockReturnValue({
      data: { userProvidedDocumentIds: ['doc-soo'] },
    });

    renderModal();

    expect(await screen.findByTestId('build-type-doc-soo')).toHaveTextContent('User-provided');
  });

  it('renders the document summary when present', async () => {
    (useGetDocuments as jest.Mock).mockReturnValue({
      data: {
        documents: [
          {
            id: 'doc-soo',
            filename: 'solicitation.pdf',
            uploadStatus: DocumentUploadStatus.Completed,
            dataProfile: { type: 'SOO', summary: 'This solicitation seeks cloud modernization services.' },
          },
        ],
      },
    });

    renderModal();

    expect(await screen.findByTestId('summary-doc-soo'))
      .toHaveTextContent('This solicitation seeks cloud modernization services.');
  });

  it('filters documents by the search box', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(await screen.findByTestId('schema-row-doc-soo')).toBeInTheDocument();

    await user.type(screen.getByTestId('schema-table-search'), 'nomatch');

    await waitFor(() => {
      expect(screen.queryByTestId('schema-row-doc-soo')).not.toBeInTheDocument();
    });
  });

  it('groups documents under their collection folder', async () => {
    (useGetCollections as jest.Mock).mockReturnValue({
      data: { collections: [{ id: 'c1', name: 'Pursuit', color: null }] },
    });
    (useGetDocuments as jest.Mock).mockReturnValue({
      data: {
        documents: [
          {
            id: 'doc-soo',
            filename: 'solicitation.pdf',
            uploadStatus: DocumentUploadStatus.Completed,
            dataProfile: { type: 'SOO' },
            collections: [{ id: 'c1', name: 'Pursuit', color: null }],
          },
        ],
      },
    });

    renderModal();

    expect(await screen.findByTestId('schema-group-c1')).toBeInTheDocument();
    expect(screen.getByTestId('schema-row-doc-soo')).toBeInTheDocument();
  });

  it('collapses and expands a folder group', async () => {
    const user = userEvent.setup();
    (useGetCollections as jest.Mock).mockReturnValue({
      data: { collections: [{ id: 'c1', name: 'Pursuit', color: null }] },
    });
    (useGetDocuments as jest.Mock).mockReturnValue({
      data: {
        documents: [
          {
            id: 'doc-soo',
            filename: 'solicitation.pdf',
            uploadStatus: DocumentUploadStatus.Completed,
            dataProfile: { type: 'SOO' },
            collections: [{ id: 'c1', name: 'Pursuit', color: null }],
          },
        ],
      },
    });

    renderModal();

    expect(await screen.findByTestId('schema-row-doc-soo')).toBeInTheDocument();

    await user.click(screen.getByTestId('schema-group-toggle-c1'));
    expect(screen.queryByTestId('schema-row-doc-soo')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('schema-group-toggle-c1'));
    expect(screen.getByTestId('schema-row-doc-soo')).toBeInTheDocument();
  });

  it('opens the move-to-folder modal for a document', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByTestId('move-folder-doc-soo'));

    expect(await screen.findByTestId('manage-collections-modal')).toHaveTextContent('solicitation.pdf');
  });

  it('shows uncategorized documents in their own group', async () => {
    renderModal();

    expect(await screen.findByTestId('schema-group-uncategorized')).toBeInTheDocument();
    expect(screen.getByTestId('schema-row-doc-soo')).toBeInTheDocument();
  });

  it('does not show the uncategorized group when all documents have collections', async () => {
    (useGetCollections as jest.Mock).mockReturnValue({
      data: { collections: [{ id: 'c1', name: 'Pursuit', color: null }] },
    });
    (useGetDocuments as jest.Mock).mockReturnValue({
      data: {
        documents: [
          {
            id: 'doc-soo',
            filename: 'solicitation.pdf',
            uploadStatus: DocumentUploadStatus.Completed,
            dataProfile: { type: 'SOO' },
            collections: [{ id: 'c1', name: 'Pursuit', color: null }],
          },
        ],
      },
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByTestId('schema-group-c1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('schema-group-uncategorized')).not.toBeInTheDocument();
  });
});
