import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Artifact } from '../types/message';

interface ChatContextData {
  chatId: string | null;
  setChatId: (chatId: string) => void;
  promptId: string | null;
  setPromptId: (promptId: string | null) => void;
  pendingMessage: string | null;
  setPendingMessage: (message: string | null) => void;
  modelId: string | null;
  setModelId: (modelId: string) => void;
  isLastMessageRetry: boolean;
  setIsLastMessageRetry: (isLastMessageRetry: boolean) => void;
  regeneratingResponse: boolean;
  setRegeneratingResponse: (isRegenerating: boolean) => void;
  knowledgeBaseIds: string[];
  setKnowledgeBaseIds: (ids: string[]) => void;
  selectedArtifact: Artifact | null;
  setSelectedArtifact: (artifact: Artifact | null) => void;
  systemMessage: string | null;
  setSystemMessage: (content: string) => void;
}

const ChatContext = createContext<ChatContextData>({
  chatId: null,
  setChatId: () => { },
  promptId: null,
  setPromptId: () => { },
  pendingMessage: null,
  setPendingMessage: () => { },
  modelId: null,
  setModelId: () => { },
  isLastMessageRetry: false,
  setIsLastMessageRetry: () => { },
  regeneratingResponse: false,
  setRegeneratingResponse: () => { },
  knowledgeBaseIds: [],
  setKnowledgeBaseIds: () => { },
  selectedArtifact: null,
  setSelectedArtifact: () => {},
  systemMessage: null,
  setSystemMessage: () => { },
});

type ChatProviderProps = {
  children: React.ReactNode;
  chatId?: string | null;
  promptId?: string | null;
  modelId?: string | null;
  initialKnowledgeBaseIds?: string[];
};

export const ChatProvider = ({
  children,
  chatId: cid,
  promptId: pid,
  modelId: mid,
  initialKnowledgeBaseIds = [],
}: ChatProviderProps) => {
  const [chatId, setChatId] = useState(cid ?? null);
  const [promptId, setPromptId] = useState(pid ?? null);
  const [modelId, setModelId] = useState(mid ?? null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [isLastMessageRetry, setIsLastMessageRetry] = useState(false);
  const [regeneratingResponse, setRegeneratingResponse] = useState(false);
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>(
    initialKnowledgeBaseIds
  );
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);

  useEffect(() => {
    setChatId(cid !== undefined ? cid : null);
    setPromptId(pid !== undefined ? pid : null);
    setModelId(mid !== undefined ? mid : null);
  }, [cid, pid, mid]);

  const values = useMemo(
    () => ({
      chatId,
      setChatId,
      promptId,
      setPromptId,
      pendingMessage,
      setPendingMessage,
      isLastMessageRetry,
      setIsLastMessageRetry,
      regeneratingResponse,
      setRegeneratingResponse,
      modelId,
      setModelId,
      knowledgeBaseIds,
      setKnowledgeBaseIds,
      selectedArtifact,
      setSelectedArtifact,
      systemMessage,
      setSystemMessage,
    }),
    [
      chatId,
      setChatId,
      promptId,
      setPromptId,
      pendingMessage,
      setPendingMessage,
      isLastMessageRetry,
      setIsLastMessageRetry,
      regeneratingResponse,
      setRegeneratingResponse,
      modelId,
      setModelId,
      knowledgeBaseIds,
      setKnowledgeBaseIds,
      selectedArtifact,
      setSelectedArtifact,
      systemMessage,
      setSystemMessage,
    ]
  );

  return <ChatContext.Provider value={values}>{children}</ChatContext.Provider>;
};

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('An unexpected error occurred. Please try again later.');
  }

  return context;
}
