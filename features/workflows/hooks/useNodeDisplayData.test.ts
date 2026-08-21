import { renderHook } from '@testing-library/react';
import { Node } from 'reactflow';

import { useNodeDisplayData } from './useNodeDisplayData';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/document-upload/get-documents');

const makeNode = (
  id: string,
  type: PrimitiveType,
): Node<PrimitiveNodeData> => ({
  id,
  data: { type, label: type, icon: () => null, color: '', config: {} },
  position: { x: 0, y: 0 },
});

const mockModels = [
  { id: 'model-1', name: 'Claude Sonnet' },
  { id: 'model-2', name: 'Claude Haiku' },
];

const mockDocuments = [
  { id: 'doc-1', filename: 'report.pdf' },
  { id: 'doc-2', filename: 'brief.docx' },
];

const mockProviderId = 'provider-abc';

describe('useNodeDisplayData', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetAvailableModels as jest.Mock).mockReturnValue({ data: undefined });
    (useGetSystemConfig as jest.Mock).mockReturnValue({ data: undefined });
    (useGetDocuments as jest.Mock).mockReturnValue({ data: undefined });
  });

  describe('enabled flags', () => {
    it('disables all queries when the canvas is empty', () => {
      renderHook(() => useNodeDisplayData([]));

      expect(useGetAvailableModels).toHaveBeenCalledWith({ enabled: false });
      expect(useGetSystemConfig).toHaveBeenCalledWith({ enabled: false });
      expect(useGetDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
    });

    it('disables all queries for report-only canvas', () => {
      const nodes = [makeNode('node-1', PrimitiveType.ARTIFACT)];
      renderHook(() => useNodeDisplayData(nodes));

      expect(useGetAvailableModels).toHaveBeenCalledWith({ enabled: false });
      expect(useGetSystemConfig).toHaveBeenCalledWith({ enabled: false });
      expect(useGetDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
    });

    it('enables only models query when canvas has an LLM node', () => {
      const nodes = [makeNode('node-1', PrimitiveType.PROMPT)];
      renderHook(() => useNodeDisplayData(nodes));

      expect(useGetAvailableModels).toHaveBeenCalledWith({ enabled: true });
      expect(useGetSystemConfig).toHaveBeenCalledWith({ enabled: false });
      expect(useGetDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
    });

    it('enables only document queries when canvas has a document node', () => {
      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: { documentLibraryDocumentUploadProviderId: mockProviderId },
      });

      const nodes = [makeNode('node-1', PrimitiveType.DOCUMENT)];
      renderHook(() => useNodeDisplayData(nodes));

      expect(useGetAvailableModels).toHaveBeenCalledWith({ enabled: false });
      expect(useGetSystemConfig).toHaveBeenCalledWith({ enabled: true });
      expect(useGetDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
      );
    });

    it('enables all queries when canvas has both LLM and document nodes', () => {
      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: { documentLibraryDocumentUploadProviderId: mockProviderId },
      });

      const nodes = [
        makeNode('node-1', PrimitiveType.PROMPT),
        makeNode('node-2', PrimitiveType.DOCUMENT),
      ];
      renderHook(() => useNodeDisplayData(nodes));

      expect(useGetAvailableModels).toHaveBeenCalledWith({ enabled: true });
      expect(useGetSystemConfig).toHaveBeenCalledWith({ enabled: true });
      expect(useGetDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
      );
    });

    it('does not enable documents until systemConfig resolves the provider ID', () => {
      (useGetSystemConfig as jest.Mock).mockReturnValue({ data: undefined });

      const nodes = [makeNode('node-1', PrimitiveType.DOCUMENT)];
      renderHook(() => useNodeDisplayData(nodes));

      expect(useGetSystemConfig).toHaveBeenCalledWith({ enabled: true });
      expect(useGetDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
    });
  });

  describe('return value', () => {
    it('returns empty arrays when queries have not resolved', () => {
      const { result } = renderHook(() => useNodeDisplayData([]));

      expect(result.current.models).toEqual([]);
      expect(result.current.documents).toEqual([]);
    });

    it('returns models from useGetAvailableModels', () => {
      (useGetAvailableModels as jest.Mock).mockReturnValue({
        data: { availableModels: mockModels },
      });

      const nodes = [makeNode('node-1', PrimitiveType.PROMPT)];
      const { result } = renderHook(() => useNodeDisplayData(nodes));

      expect(result.current.models).toEqual(mockModels);
    });

    it('returns mapped documents from useGetDocuments', () => {
      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: { documentLibraryDocumentUploadProviderId: mockProviderId },
      });
      (useGetDocuments as jest.Mock).mockReturnValue({
        data: { documents: mockDocuments },
      });

      const nodes = [makeNode('node-1', PrimitiveType.DOCUMENT)];
      const { result } = renderHook(() => useNodeDisplayData(nodes));

      expect(result.current.documents).toEqual([
        { id: 'doc-1', filename: 'report.pdf' },
        { id: 'doc-2', filename: 'brief.docx' },
      ]);
    });

    it('passes the provider ID from systemConfig to useGetDocuments', () => {
      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: { documentLibraryDocumentUploadProviderId: mockProviderId },
      });

      const nodes = [makeNode('node-1', PrimitiveType.DOCUMENT)];
      renderHook(() => useNodeDisplayData(nodes));

      expect(useGetDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ documentUploadProviderId: mockProviderId }),
      );
    });
  });
});
