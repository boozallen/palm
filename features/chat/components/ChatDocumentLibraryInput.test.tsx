import { render, screen } from '@testing-library/react';

import ChatDocumentLibraryInput from './ChatDocumentLibraryInput';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';

jest.mock('@/features/shared/api/get-feature-flag');

describe('ChatDocumentLibraryInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render checkbox when feature flag is off', () => {
    (useGetFeatureFlag as jest.Mock).mockReturnValue({
      data: { isFeatureOn: false },
      isPending: false,
      error: null,
    });

    render(<ChatDocumentLibraryInput />);
    const checkbox = screen.queryByTestId('chat-document-library-input');
    expect(checkbox).not.toBeInTheDocument();
  });

  it('renders checkbox when feature flag is on', () => {
    (useGetFeatureFlag as jest.Mock).mockReturnValue({
      data: { isFeatureOn: true },
      isPending: false,
      error: null,
    });

    render(<ChatDocumentLibraryInput />);
    const checkbox = screen.getByTestId('chat-document-library-input');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('type', 'checkbox');
  });
});
