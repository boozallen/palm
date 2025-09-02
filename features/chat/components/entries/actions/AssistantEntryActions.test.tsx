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
    messageId: '18b87d58-51c0-48c2-abf5-36f2b3a53c09',
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

  it('displays RegenerateChatResponse', () => {
    render(<AssistantEntryActions {...mockProps} />);

    expect(screen.getByTestId('RegenerateChatResponse')).toBeInTheDocument();
  });
});
