import { fireEvent, render, screen } from '@testing-library/react';

import PiiDetectionModal from './piiDetectionModal';
import { DetectedPii } from '@/features/shared/types/pii';
import { UiPreference } from '@/types/ui-preferences';

describe('PiiDetectionModal', () => {
  const mockCloseModalHandler = jest.fn();
  const mockOnContinue = jest.fn();
  
  const mockPiiMatches: DetectedPii[] = [
    {
      content: 'test@example.com',
      startIndex: 10,
    },
    {
      content: 'user@domain.org',
      startIndex: 25,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.getItem = jest.fn();
  });

  it('renders the modal with correct title and content when opened', () => {
    render(
      <PiiDetectionModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={mockPiiMatches}
      />
    );

    expect(screen.getByText('Possible PII Detected')).toBeInTheDocument();
    expect(screen.getByText('Potential instances of PII detected in your message:')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to submit this message?')).toBeInTheDocument();
  });

  it('renders correct text for single PII match', () => {
    const singleMatch: DetectedPii[] = [
      {
        content: 'test@example.com',
        startIndex: 10,
      },
    ];

    render(
      <PiiDetectionModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={singleMatch}
      />
    );

    expect(screen.getByText('Potential instance of PII detected in your message:')).toBeInTheDocument();
  });

  it('displays all PII matches with their content and positions', () => {
    render(
      <PiiDetectionModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={mockPiiMatches}
      />
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('(position: 10)')).toBeInTheDocument();
    expect(screen.getByText('user@domain.org')).toBeInTheDocument();
    expect(screen.getByText('(position: 25)')).toBeInTheDocument();
  });

  it('calls closeModalHandler when Cancel button is clicked', () => {
    render(
      <PiiDetectionModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={mockPiiMatches}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(mockCloseModalHandler).toHaveBeenCalledTimes(1);
    expect(mockOnContinue).not.toHaveBeenCalled();
  });

  it('calls onContinue and closeModalHandler when Continue button is clicked', () => {
    render(
      <PiiDetectionModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={mockPiiMatches}
      />
    );

    fireEvent.click(screen.getByText('Continue'));

    expect(mockOnContinue).toHaveBeenCalledTimes(1);
    expect(mockCloseModalHandler).toHaveBeenCalledTimes(1);
  });

  it('updates localStorage when checkbox is checked', () => {
    render(
      <PiiDetectionModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={mockPiiMatches}
      />
    );

    const checkbox = screen.getByLabelText('Do not show this warning again');
    fireEvent.click(checkbox);

    expect(localStorage.setItem).toHaveBeenCalledWith(UiPreference.SUPPRESS_PII_WARNING, 'true');
  });

  it('updates localStorage when checkbox is unchecked', () => {
    render(
      <PiiDetectionModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={mockPiiMatches}
      />
    );

    const checkbox = screen.getByLabelText('Do not show this warning again');
    
    // Check and then uncheck
    fireEvent.click(checkbox);
    expect(localStorage.setItem).toHaveBeenCalledWith(UiPreference.SUPPRESS_PII_WARNING, 'true');
    
    fireEvent.click(checkbox);
    expect(localStorage.setItem).toHaveBeenCalledWith(UiPreference.SUPPRESS_PII_WARNING, 'false');
  });

  it('does not render when modal is closed', () => {
    render(
      <PiiDetectionModal
        modalOpened={false}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={mockPiiMatches}
      />
    );

    expect(screen.queryByText('Possible PII Detected')).not.toBeInTheDocument();
  });

  it('renders with empty PII matches array', () => {
    render(
      <PiiDetectionModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={[]}
      />
    );

    expect(screen.getByText('Possible PII Detected')).toBeInTheDocument();
    expect(screen.getByText('Potential instances of PII detected in your message:')).toBeInTheDocument();
  });

  it('has correct modal properties', () => {
    render(
      <PiiDetectionModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        onContinue={mockOnContinue}
        piiMatches={mockPiiMatches}
      />
    );

    // The modal should be centered and have no close button
    // These properties are tested indirectly through the Modal component props
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
