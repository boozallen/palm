export type Chat = {
  id: string,
  userId: string,
  modelId: string | null,
  promptId: string | null,
  summary: string | null,
  createdAt: Date,
  updatedAt: Date,
}
