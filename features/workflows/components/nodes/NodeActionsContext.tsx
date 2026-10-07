import { createContext, useContext } from 'react';

export interface NodeDisplayData {
  models: Array<{ id: string; name: string }>;
  documents: Array<{ id: string; filename: string }>;
}

interface NodeActionsContextType {
  onDelete: (nodeId: string) => void;
  onConfigure: (nodeId: string) => void;
  displayData: NodeDisplayData;
  nodeStatusMap?: Map<string, string>;
  isExecuting?: boolean;
  isConfigPanelOpen?: boolean;
}

export const NodeActionsContext = createContext<NodeActionsContextType | null>(null);

export function useNodeActions(): NodeActionsContextType {
  const ctx = useContext(NodeActionsContext);
  if (!ctx) {
    throw new Error('useNodeActions must be used within NodeActionsContext.Provider');
  }
  return ctx;
}
