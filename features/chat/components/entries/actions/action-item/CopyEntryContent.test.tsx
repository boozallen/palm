import { fireEvent, render, screen } from '@testing-library/react';

import CopyEntryContent from './CopyEntryContent';
import { AuditRecordEvent, AuditRecordResourceType } from '@/features/shared/types/audit-record';
import { useChat } from '@/features/chat/providers/ChatProvider';

const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: () => ({ mutate: mockCreateAuditRecord }),
}));

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

describe('CopyEntryContent', () => {
  // Audit metadata only keeps ids the server can validate as uuids, so the
  // fixtures have to look like real records.
  const mockChatId = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';
  const mockMessageId = 'ce1f6a2f-9f5f-4d4e-8f9a-5d3ba2a35f2b';

  const mockProps = {
    messageContent: 'This is a test message',
    messageId: mockMessageId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useChat as jest.Mock).mockReturnValue({ chatId: mockChatId });
  });

  it('renders action icon', () => {
    render(<CopyEntryContent {...mockProps} />);

    const actionIcon = screen.getByTestId('copy-button');

    expect(actionIcon).toBeInTheDocument();
  });

  it('does not display tooltip by default', async () => {
    render(<CopyEntryContent {...mockProps} />);

    expect(screen.queryByText('Copy Message')).not.toBeInTheDocument();
  });

  it('displays tooltip on hover', async () => {
    render(<CopyEntryContent {...mockProps} />);

    const actionIcon = screen.getByTestId('copy-button');
    fireEvent.mouseEnter(actionIcon);

    const tooltip = await screen.findByText('Copy Message');

    expect(tooltip).toBeInTheDocument();
  });

  it('displays IconCopy', () => {
    render(<CopyEntryContent {...mockProps} />);

    const iconCopy = screen.getByTestId('copy-icon');

    expect(iconCopy).toBeInTheDocument();
  });

  it('records an audit record identifying the copied message', () => {
    render(<CopyEntryContent {...mockProps} />);

    fireEvent.click(screen.getByTestId('copy-button'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.CopyContentToClipboard,
      label: 'chat message content',
      metadata: {
        resourceType: AuditRecordResourceType.ChatMessage,
        resourceIds: [mockMessageId],
        chatMessageId: mockMessageId,
        chatId: mockChatId,
      },
    });
  });

  it('still records the copy when the message has no persisted id yet', () => {
    // Streaming and retry entries carry placeholder ids. The audit record is
    // more valuable than the id, so it goes out without one.
    render(<CopyEntryContent messageContent={mockProps.messageContent} messageId='pending' />);

    fireEvent.click(screen.getByTestId('copy-button'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.CopyContentToClipboard,
      label: 'chat message content',
      metadata: {
        resourceType: AuditRecordResourceType.ChatMessage,
        chatId: mockChatId,
      },
    });
  });
});
