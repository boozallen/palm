/**
 * Central node type registry — single source of truth for all node type definitions.
 * Adding a new node type requires only one entry here and one entry in PrimitiveFactory.
 */

import { ComponentType } from 'react';
import {
  IconFile,
  IconWorldWww,
  IconMessage,
  IconFileText,
} from '@tabler/icons-react';

import { PrimitiveType, NodeConfigProps, NodeTypeDefinition } from '@/features/workflows/types/primitive';
import DocumentConfig from '@/features/workflows/components/nodes/config/DocumentConfig';
import WebScraperConfig from '@/features/workflows/components/nodes/config/WebScraperConfig';
import PromptConfig from '@/features/workflows/components/nodes/config/PromptConfig';
import ArtifactConfig from '@/features/workflows/components/nodes/config/ArtifactConfig';

export type { NodeConfigProps, NodeTypeDefinition };

export const NODE_REGISTRY: Record<PrimitiveType, NodeTypeDefinition> = {
  [PrimitiveType.DOCUMENT]: {
    type: PrimitiveType.DOCUMENT,
    label: 'Document',
    description: 'Upload or select existing',
    icon: IconFile,
    color: 'var(--mantine-color-blue-6)',
    enabled: true,
    ConfigComponent: DocumentConfig as ComponentType<NodeConfigProps>,
    defaultConfig: {},
  },
  [PrimitiveType.WEBSCRAPER]: {
    type: PrimitiveType.WEBSCRAPER,
    label: 'Web Scraper',
    description: 'Get website data',
    icon: IconWorldWww,
    color: 'var(--mantine-color-blue-6)',
    enabled: false,
    ConfigComponent: WebScraperConfig as ComponentType<NodeConfigProps>,
    defaultConfig: { url: '', maxPages: 1 },
  },
  [PrimitiveType.PROMPT]: {
    type: PrimitiveType.PROMPT,
    label: 'Prompt',
    description: 'Instructions + AI model',
    icon: IconMessage,
    color: 'var(--mantine-color-violet-6)',
    enabled: true,
    ConfigComponent: PromptConfig,
    defaultConfig: { model: '', temperature: 0.5, topP: 0.5 },
  },
  [PrimitiveType.ARTIFACT]: {
    type: PrimitiveType.ARTIFACT,
    label: 'Artifact',
    description: 'Word, PDF, Excel, HTML, etc.',
    icon: IconFileText,
    color: 'var(--mantine-color-green-6)',
    enabled: true,
    ConfigComponent: ArtifactConfig as ComponentType<NodeConfigProps>,
    defaultConfig: { format: '.docx' },
  },
};

export function getNodeDef(type: PrimitiveType): NodeTypeDefinition {
  const def = NODE_REGISTRY[type];
  if (!def) {
    throw new Error(`Unknown node type: ${type}`);
  }
  return def;
}
