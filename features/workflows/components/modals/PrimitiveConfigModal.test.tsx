import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import PrimitiveConfigModal from './PrimitiveConfigModal';
import { PrimitiveType, NodeConfigProps } from '@/features/workflows/types/primitive';

jest.mock('@mantine/notifications');

jest.mock('@/features/workflows/utils/node-registry', () => {
  const React = require('react');
  const { PrimitiveType } = require('@/features/workflows/types/primitive');

  const MockPromptConfig = ({ config, onChange }: NodeConfigProps) =>
    React.createElement('div', { 'data-testid': 'llm-prompt-config' },
      React.createElement('button', { 'data-testid': 'update-prompt-button', onClick: () => onChange({ ...config, prompt: 'test-prompt' }) }, 'Update Prompt'),
    );

  const MockWebScraperConfig = ({ config, onChange }: NodeConfigProps) =>
    React.createElement('div', { 'data-testid': 'web-scraper-config' },
      React.createElement('button', { onClick: () => onChange({ ...config, url: 'test-url' }) }, 'Update Config'),
    );

  const MockDocumentConfig = ({ config, onChange, onUploadingChange }: NodeConfigProps) =>
    React.createElement('div', { 'data-testid': 'document-input-config' },
      React.createElement('button', { 'data-testid': 'update-config-button', onClick: () => onChange({ ...config, documentId: 'test-doc' }) }, 'Update Config'),
      React.createElement('button', { 'data-testid': 'start-upload-button', onClick: () => onUploadingChange?.(true) }, 'Start Upload'),
    );

  const MockArtifactConfig = ({ config, onChange }: NodeConfigProps) =>
    React.createElement('div', { 'data-testid': 'artifact-config' },
      React.createElement('button', { onClick: () => onChange({ ...config, format: '.pdf' }) }, 'Update Config'),
    );

  type NodeTypeDefinition = import('@/features/workflows/types/primitive').NodeTypeDefinition;

  const registry: Record<string, Pick<NodeTypeDefinition, 'type' | 'label' | 'ConfigComponent' | 'defaultConfig'>> = {
    [PrimitiveType.PROMPT]: {
      type: PrimitiveType.PROMPT,
      label: 'Prompt',
      ConfigComponent: MockPromptConfig,
      defaultConfig: { model: '' },
    },
    [PrimitiveType.WEBSCRAPER]: {
      type: PrimitiveType.WEBSCRAPER,
      label: 'Web Scraper',
      ConfigComponent: MockWebScraperConfig,
      defaultConfig: { url: '', maxPages: 1 },
    },
    [PrimitiveType.DOCUMENT]: {
      type: PrimitiveType.DOCUMENT,
      label: 'Document',
      ConfigComponent: MockDocumentConfig,
      defaultConfig: {},
    },
    [PrimitiveType.ARTIFACT]: {
      type: PrimitiveType.ARTIFACT,
      label: 'Artifact',
      ConfigComponent: MockArtifactConfig,
      defaultConfig: { format: '.docx' },
    },
  };

  return {
    NODE_REGISTRY: registry,
    getNodeDef: (type: string) => {
      const def = registry[type];
      if (!def) {
        throw new Error(`Unknown node type: ${type}`);
      }
      return def;
    },
  };
});

describe('PrimitiveConfigModal', () => {
  const mockProps = {
    opened: true,
    onClose: jest.fn(),
    nodeType: PrimitiveType.PROMPT,
    nodeId: 'test-node-id',
    nodeLabel: 'Test Node',
    currentConfig: { prompt: 'initial-prompt' },
    onSave: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal when opened', () => {
    render(<PrimitiveConfigModal {...mockProps} />);

    expect(screen.getByTestId('primitive-config-modal')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
  });

  it('does not render when not opened', () => {
    render(<PrimitiveConfigModal {...mockProps} opened={false} />);

    expect(screen.queryByTestId('primitive-config-modal')).not.toBeInTheDocument();
  });

  it('calls onSave with correct parameters when save button is clicked', async () => {
    const user = userEvent.setup();
    render(<PrimitiveConfigModal {...mockProps} />);

    await user.click(screen.getByTestId('update-prompt-button'));
    await user.click(screen.getByTestId('save-button'));

    expect(mockProps.onSave).toHaveBeenCalledWith('test-node-id', 'Test Node', { prompt: 'test-prompt' });
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('prevents closing modal while uploading', async () => {
    const user = userEvent.setup();
    render(
      <PrimitiveConfigModal
        {...mockProps}
        nodeType={PrimitiveType.DOCUMENT}
        currentConfig={{ documentId: undefined }}
      />,
    );

    await user.click(screen.getByTestId('start-upload-button'));

    expect(screen.getByTestId('cancel-button')).toBeDisabled();
  });

  it('disables save button while uploading', async () => {
    const user = userEvent.setup();
    render(
      <PrimitiveConfigModal
        {...mockProps}
        nodeType={PrimitiveType.DOCUMENT}
        currentConfig={{ documentId: undefined }}
      />,
    );

    await user.click(screen.getByTestId('start-upload-button'));

    expect(screen.getByTestId('save-button')).toBeDisabled();
  });

  describe('with database saving functionality', () => {
    const mockOnSaveToDatabase = jest.fn();
    const propsWithDatabase = {
      ...mockProps,
      workflowId: 'test-workflow-id',
      onSaveToDatabase: mockOnSaveToDatabase,
    };

    it('calls onSaveToDatabase before local save when workflowId is provided', async () => {
      const user = userEvent.setup();
      mockOnSaveToDatabase.mockResolvedValue(undefined);

      render(<PrimitiveConfigModal {...propsWithDatabase} />);

      await user.click(screen.getByTestId('save-button'));

      expect(mockOnSaveToDatabase).toHaveBeenCalledWith(
        'test-node-id',
        'Test Node',
        { prompt: 'initial-prompt' },
      );
      expect(mockProps.onSave).toHaveBeenCalledWith(
        'test-node-id',
        'Test Node',
        { prompt: 'initial-prompt' },
      );
    });

    it('shows loading state while saving to database', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockOnSaveToDatabase.mockReturnValue(savePromise);

      render(<PrimitiveConfigModal {...propsWithDatabase} />);

      await user.click(screen.getByTestId('save-button'));

      expect(screen.getByTestId('save-button')).toHaveTextContent('Saving...');
      expect(screen.getByTestId('save-button')).toBeDisabled();

      resolvePromise!();
      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows error notification when database save fails', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockOnSaveToDatabase.mockRejectedValue(new Error('Database save failed'));

      render(<PrimitiveConfigModal {...propsWithDatabase} />);

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Save Failed',
          message: 'Database save failed',
          color: 'red',
          icon: <IconX />,
        });
      });

      expect(mockProps.onSave).not.toHaveBeenCalled();
      expect(mockProps.onClose).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('prevents closing modal while saving to database', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockOnSaveToDatabase.mockReturnValue(savePromise);

      render(<PrimitiveConfigModal {...propsWithDatabase} />);

      await user.click(screen.getByTestId('save-button'));

      expect(screen.getByTestId('cancel-button')).toBeDisabled();

      resolvePromise!();
      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('falls back to local save when no workflowId is provided', async () => {
      const user = userEvent.setup();
      render(
        <PrimitiveConfigModal
          {...mockProps}
          onSaveToDatabase={mockOnSaveToDatabase}
        />,
      );

      await user.click(screen.getByTestId('save-button'));

      expect(mockOnSaveToDatabase).not.toHaveBeenCalled();
      expect(mockProps.onSave).toHaveBeenCalledWith(
        'test-node-id',
        'Test Node',
        { prompt: 'initial-prompt' },
      );
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('renders appropriate config component based on primitive type', () => {
    const { rerender } = render(<PrimitiveConfigModal {...mockProps} />);
    expect(screen.getByTestId('llm-prompt-config')).toBeInTheDocument();

    rerender(
      <PrimitiveConfigModal
        {...mockProps}
        nodeType={PrimitiveType.WEBSCRAPER}
        currentConfig={{ url: 'test-url' }}
      />,
    );
    expect(screen.getByTestId('web-scraper-config')).toBeInTheDocument();
  });

  it('updates label when text input changes', async () => {
    const user = userEvent.setup();
    render(<PrimitiveConfigModal {...mockProps} />);

    const textInput = screen.getByTestId('node-label-input');
    await user.clear(textInput);
    await user.type(textInput, 'Updated Label');

    await user.click(screen.getByTestId('save-button'));

    expect(mockProps.onSave).toHaveBeenCalledWith(
      'test-node-id',
      'Updated Label',
      { prompt: 'initial-prompt' },
    );
  });
});
