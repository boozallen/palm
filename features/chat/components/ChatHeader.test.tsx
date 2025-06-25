import { render, screen } from '@testing-library/react';
import ChatHeader from './ChatHeader';

jest.mock('./ChatModelSelect', () => {
  return function ChatModelSelect() {
    return <div data-testid='chat-model-select'></div>;
  };
});

jest.mock('./ChatKnowledgeBasesSelect', () => {
  return function ChatKnowledgeBasesSelect() {
    return <div data-testid='chat-knowledge-bases-select'></div>;
  };
});

jest.mock('./ChatDocumentLibraryInput', () => {
  return function ChatDocumentLibraryInput() {
    return <div data-testid='chat-document-library-input'></div>;
  };
});

describe('ChatHeader', () => {
  it('renders child components', () => {
    render(<ChatHeader />);

    const chatModelSelect = screen.getByTestId('chat-model-select');
    const chatKnowledgeBasesSelect = screen.getByTestId('chat-knowledge-bases-select');
    const chatDocumentLibraryInput = screen.getByTestId('chat-document-library-input');

    expect(chatModelSelect).toBeInTheDocument();
    expect(chatKnowledgeBasesSelect).toBeInTheDocument();
    expect(chatDocumentLibraryInput).toBeInTheDocument();
  });
});
