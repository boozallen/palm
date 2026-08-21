import { render, screen } from '@testing-library/react';

import useGetTemplates from '@/features/settings/api/templates/get-templates';
import ArtifactTemplatesTable from './ArtifactTemplatesTable';

jest.mock('./ArtifactTemplatesRow', () => {
  return function MockArtifactTemplatesRow() {
    return <tr><td>Mock Templates Row</td></tr>;
  };
});

jest.mock('@/features/settings/api/templates/get-templates');

describe('ArtifactTemplatesTable', () => {
  const mockData = {
    templates: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        filename: 'sample-template.pptx',
        createdAt: new Date('2026-08-10T00:00:00.000Z'),
        updatedAt: new Date('2026-08-10T00:00:00.000Z'),
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        filename: 'client-template.docx',
        createdAt: new Date('2026-08-09T00:00:00.000Z'),
        updatedAt: new Date('2026-08-09T00:00:00.000Z'),
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetTemplates as jest.Mock).mockReturnValue({
      data: mockData,
      isPending: false,
      error: null,
    });
  });

  it('renders table headers', () => {
    render(<ArtifactTemplatesTable />);

    expect(screen.getByText('Filename')).toBeInTheDocument();
    expect(screen.getByText('File Type')).toBeInTheDocument();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
  });

  it('renders a row for each template', () => {
    render(<ArtifactTemplatesTable />);

    expect(screen.getAllByText('Mock Templates Row')).toHaveLength(mockData.templates.length);
  });

  it('renders loading state while pending', () => {
    (useGetTemplates as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: true,
      error: null,
    });

    render(<ArtifactTemplatesTable />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('artifact-templates-table')).not.toBeInTheDocument();
  });

  it('renders error message if templates failed to load', () => {
    (useGetTemplates as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error('Failed to load templates'),
    });

    render(<ArtifactTemplatesTable />);

    expect(screen.getByText('Failed to load templates')).toBeInTheDocument();
    expect(screen.queryByTestId('artifact-templates-table')).not.toBeInTheDocument();
  });

  it('renders empty state when no templates exist', () => {
    (useGetTemplates as jest.Mock).mockReturnValue({
      data: { templates: [] },
      isPending: false,
      error: null,
    });

    render(<ArtifactTemplatesTable />);

    expect(screen.getByText('No templates found.')).toBeInTheDocument();
    expect(screen.queryByTestId('artifact-templates-table')).not.toBeInTheDocument();
  });
});
