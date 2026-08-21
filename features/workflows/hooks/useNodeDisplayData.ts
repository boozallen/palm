import { Node } from 'reactflow';

import { PrimitiveType } from '@/features/workflows/types/primitive';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';
import { NodeDisplayData } from '@/features/workflows/components/nodes/NodeActionsContext';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

export function useNodeDisplayData(nodes: Node<PrimitiveNodeData>[]): NodeDisplayData {
  const nodeTypes = new Set(nodes.map(n => n.data.type));

  const hasPromptNode = nodeTypes.has(PrimitiveType.PROMPT);
  const hasDocumentNode = nodeTypes.has(PrimitiveType.DOCUMENT);

  const { data: modelsData } = useGetAvailableModels({ enabled: hasPromptNode });
  const { data: systemConfig } = useGetSystemConfig({ enabled: hasDocumentNode });

  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId ?? '';
  const { data: libraryDocs } = useGetDocuments({
    documentUploadProviderId,
    enabled: hasDocumentNode && !!documentUploadProviderId,
  });

  return {
    models: modelsData?.availableModels ?? [],
    documents: (libraryDocs?.documents ?? []).map(d => ({ id: d.id, filename: d.filename })),
  };
}
