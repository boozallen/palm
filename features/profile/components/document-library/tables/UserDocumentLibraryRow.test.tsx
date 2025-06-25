import { render, screen } from '@testing-library/react';

import UserDocumentLibraryRow from './UserDocumentLibraryRow';

describe('UserDocumentLibraryRow', () => {
  const mockDocument = {
    id: 'f66b2688-a077-4b01-be8e-3cedbc879906',
    userId: 'c59e8e1f-b242-437b-99e1-fe07d67b4d24',
    label: 'Software Development Tips',
    uploadedAt: '2024-08-24T12:42:53.382',
  };

  beforeEach(() => {
    render(
      <table>
        <tbody>
          <UserDocumentLibraryRow document={mockDocument} />
        </tbody>
      </table>
    );
  });

  it('renders label and trash icon', () => {
    const label = screen.getByText(mockDocument.label);
    const trashIcon = screen.getByTestId(
      `${mockDocument.id}-delete-document`
    );

    expect(label).toBeInTheDocument();
    expect(trashIcon).toBeInTheDocument();
  });

  it('renders formatted date', () => {
    const formattedDate = screen.getByText('8/24/2024, 12:42 PM');

    expect(formattedDate).toBeInTheDocument();
  });
});
