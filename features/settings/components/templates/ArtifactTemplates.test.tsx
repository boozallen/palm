import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import ArtifactTemplates from './ArtifactTemplates';

jest.mock('@mantine/hooks');

jest.mock('./modals/UploadTemplateModal', () => {
  return function UploadTemplateModal() {
    return <div>Upload Template Modal</div>;
  };
});

jest.mock('./tables/ArtifactTemplatesTable', () => {
  return function ArtifactTemplatesTable() {
    return <div>Artifact Templates Table</div>;
  };
});

describe('ArtifactTemplates', () => {
  const openMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: openMock, close: jest.fn() },
    ]);
  });

  it('renders header with title and upload button', () => {
    render(<ArtifactTemplates />);

    expect(screen.getByTestId('artifact-templates-title')).toBeInTheDocument();
    expect(screen.getByTestId('upload-template-button')).toBeInTheDocument();
  });

  it('renders ArtifactTemplatesTable', () => {
    render(<ArtifactTemplates />);

    expect(screen.getByText('Artifact Templates Table')).toBeInTheDocument();
  });

  it('renders UploadTemplateModal', () => {
    render(<ArtifactTemplates />);

    expect(screen.getByText('Upload Template Modal')).toBeInTheDocument();
  });

  it('opens UploadTemplateModal when upload button is clicked', () => {
    render(<ArtifactTemplates />);

    screen.getByTestId('upload-template-button').click();

    expect(openMock).toHaveBeenCalledTimes(1);
  });
});
