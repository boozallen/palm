import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import ArtifactTemplatesRow from './ArtifactTemplatesRow';

jest.mock('@mantine/hooks');

jest.mock('@/features/settings/components/templates/modals/DeleteTemplateModal', () => {
  return function MockDeleteTemplateModal() {
    return <tr><td>Mock Delete Template Modal</td></tr>;
  };
});

describe('ArtifactTemplatesRow', () => {
  const mockTemplate = {
    id: '00000000-0000-0000-0000-000000000001',
    filename: 'sample-template.pptx',
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
  };

  const openMock = jest.fn();

  const container = document.body
    .appendChild(document.createElement('table'))
    .appendChild(document.createElement('tbody'));

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: openMock, close: jest.fn() },
    ]);
  });

  it('renders filename, extension, date and delete button', () => {
    render(<ArtifactTemplatesRow {...mockTemplate} />, { container });

    expect(screen.getByText(mockTemplate.filename)).toBeInTheDocument();
    expect(screen.getByText('pptx')).toBeInTheDocument();
    expect(screen.getByTestId('delete-template-button')).toBeInTheDocument();
  });

  it('opens delete modal when delete button is clicked', () => {
    render(<ArtifactTemplatesRow {...mockTemplate} />, { container });

    screen.getByTestId('delete-template-button').click();

    expect(openMock).toHaveBeenCalledTimes(1);
  });
});
