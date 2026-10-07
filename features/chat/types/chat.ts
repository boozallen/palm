export type Chat = {
  id: string,
  userId: string,
  modelId: string | null,
  promptId: string | null,
  agentProviderId: string | null,
  summary: string | null,
  useCase: string | null,
  externalSessionId: string | null,
  userGroupId: string | null,
  createdAt: Date,
  updatedAt: Date,
}
