import { render, screen, waitFor } from '@testing-library/react';
import UserGroupArtifactTemplatesTable from './UserGroupArtifactTemplatesTable';
import useGetTemplates from '@/features/settings/api/templates/get-templates';
import useGetUserGroupArtifactTemplates from '@/features/settings/api/user-groups/get-user-group-artifact-templates';

jest.mock('@/features/settings/api/templates/get-templates');
jest.mock('@/features/settings/api/user-groups/get-user-group-artifact-templates');
jest.mock('@/features/settings/api/user-groups/update-user-group-artifact-templates', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutateAsync: jest.fn(),
    error: null,
  })),
}));

const mockUserGroupId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

const mockTemplates = [
  { id: '1', filename: 'sample-template.pptx', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', filename: 'client-template.docx', createdAt: new Date(), updatedAt: new Date() },
];

describe('UserGroupArtifactTemplatesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetTemplates as jest.Mock).mockReturnValue({
      data: { templates: mockTemplates },
      isPending: false,
      error: null,
    });

    (useGetUserGroupArtifactTemplates as jest.Mock).mockReturnValue({
      data: { userGroupTemplates: [{ id: '1' }] },
      isPending: false,
      error: null,
    });
  });

  it('renders the table with templates', async () => {
    render(<UserGroupArtifactTemplatesTable id={mockUserGroupId} />);

    await waitFor(() => {
      expect(screen.getByTestId('user-group-artifact-templates-table')).toBeInTheDocument();
      expect(screen.getByText('sample-template.pptx')).toBeInTheDocument();
      expect(screen.getByText('client-template.docx')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', () => {
    (useGetTemplates as jest.Mock).mockReturnValueOnce({
      data: null,
      isPending: true,
      error: null,
    });

    render(<UserGroupArtifactTemplatesTable id={mockUserGroupId} />);

    expect(screen.queryByTestId('user-group-artifact-templates-table')).not.toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error message when templates fetch fails', () => {
    (useGetTemplates as jest.Mock).mockReturnValueOnce({
      data: null,
      isPending: false,
      error: new Error('Failed to fetch templates'),
    });

    render(<UserGroupArtifactTemplatesTable id={mockUserGroupId} />);

    expect(screen.queryByTestId('user-group-artifact-templates-table')).not.toBeInTheDocument();
    expect(screen.getByText('Failed to fetch templates')).toBeInTheDocument();
  });

  it('shows error message when user group templates fetch fails', () => {
    (useGetUserGroupArtifactTemplates as jest.Mock).mockReturnValueOnce({
      data: null,
      isPending: false,
      error: new Error('Failed to fetch user group templates'),
    });

    render(<UserGroupArtifactTemplatesTable id={mockUserGroupId} />);

    expect(screen.queryByTestId('user-group-artifact-templates-table')).not.toBeInTheDocument();
    expect(screen.getByText('Failed to fetch user group templates')).toBeInTheDocument();
  });

  it('shows empty state when no templates are configured', () => {
    (useGetTemplates as jest.Mock).mockReturnValueOnce({
      data: { templates: [] },
      isPending: false,
      error: null,
    });

    render(<UserGroupArtifactTemplatesTable id={mockUserGroupId} />);

    expect(screen.queryByTestId('user-group-artifact-templates-table')).not.toBeInTheDocument();
    expect(screen.getByText('No Artifact Templates have been configured yet.')).toBeInTheDocument();
  });
});
