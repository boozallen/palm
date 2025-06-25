import { render, screen } from '@testing-library/react';
import AssistantEntry from './AssistantEntry';
import { EntryType, MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import { List } from '@mantine/core';
import Entry from './Entry'; 
import AssistantEntryActions from '@/features/chat/components/entries/actions/AssistantEntryActions';
import React from 'react';

type CapturedEntryProps = {
  id?: string;
  avatar?: React.ReactElement;
  role?: MessageRole;
  actions?: React.ReactElement;
  citations?: any[];
  artifacts?: any[];
  children?: React.ReactNode;
  [key: string]: any;
};

let capturedEntryProps: CapturedEntryProps = {};

jest.mock('@/features/chat/components/entries/Entry', () => {
  const mockEntry = jest.fn((props: CapturedEntryProps) => {
    capturedEntryProps = { ...props };
    return <div>{props.children}</div>;
  });
  return mockEntry;
});

jest.mock('@/features/chat/components/entries/actions/AssistantEntryActions', () => {
  return jest.fn().mockReturnValue(<div data-testid='AssistantEntryActions' />);
});

describe('AssistantEntry', () => {
  const mockEntry: MessageEntry = {
    id: 'e840b4d6-ccf6-4e84-b475-7ffe1fcebf78',
    chatId: '952b2a39-e70b-471d-aa54-e2e2c7ce9168',
    type: EntryType.Message,
    createdAt: new Date(),
    role: MessageRole.Assistant,
    content: 'This is a test message',
    citations: [],
    artifacts: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedEntryProps = {};
  });

  it('renders the Markdown content', () => {
    render(
      <List>
        <AssistantEntry
          entry={mockEntry}
          isLastEntry={false}
        />
      </List>
    );
    expect(screen.getByText('This is a test message')).toBeInTheDocument();
  });

  it('calls Entry component without an avatar', () => {
    render(
      <List>
        <AssistantEntry
          entry={mockEntry}
          isLastEntry={false}
        />
      </List>
    );

    expect(Entry).toHaveBeenCalled();
    
    expect(capturedEntryProps.avatar).toBeNull();
  });

  it('calls Entry component with AssistantEntryActions', () => {
    render(
      <List>
        <AssistantEntry
          entry={mockEntry}
          isLastEntry={false}
        />
      </List>
    );

    expect(Entry).toHaveBeenCalled();
    
    expect(capturedEntryProps.actions).toBeTruthy();
    if (capturedEntryProps.actions) {
      expect(capturedEntryProps.actions.type).toBe(AssistantEntryActions);
    }
  });
});
