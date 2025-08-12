import { render, screen } from '@testing-library/react';

import AssistantEntryActions from './AssistantEntryActions';
import CopyEntryContent from './action-item/CopyEntryContent';

let capturedCopyEntryContentProps = {};

jest.mock('./action-item/CopyEntryContent', () => {
  const mockCopyEntryContent = jest.fn((props) => {
    capturedCopyEntryContentProps = { ...props };
    return <div data-testid='CopyEntryContent' />;
  });
  return mockCopyEntryContent;
});

jest.mock('./action-item/RegenerateChatResponse', () => {
  return jest.fn().mockReturnValue(<div data-testid='RegenerateChatResponse' />);
});

describe('AssistantEntryActions', () => {

  const mockProps = {
    messageContent: 'This is a test message',
    isLastEntry: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedCopyEntryContentProps = {};
  });

  it('renders the CopyEntryContent component', () => {
    render(<AssistantEntryActions {...mockProps} />);

    expect(screen.getByTestId('CopyEntryContent')).toBeInTheDocument();
  });

  it('passes the messageContent prop to the CopyEntryContent component', () => {
    render(<AssistantEntryActions {...mockProps} />);

    expect(CopyEntryContent).toHaveBeenCalled();
    
    expect(capturedCopyEntryContentProps).toEqual(
      expect.objectContaining({ 
        messageContent: mockProps.messageContent, 
      })
    );
  });

  it('displays RegenerateChatResponse when isLastEntry is true', () => {
    render(<AssistantEntryActions {...mockProps} />);

    expect(screen.getByTestId('RegenerateChatResponse')).toBeInTheDocument();
  });

  it('does not display RegenerateChatResponse when isLastEntry is false', () => {
    const tmpProps = { ...mockProps, isLastEntry: false };
    render(<AssistantEntryActions {...tmpProps} />);

    expect(screen.queryByTestId('RegenerateChatResponse')).not.toBeInTheDocument();
  });
});
