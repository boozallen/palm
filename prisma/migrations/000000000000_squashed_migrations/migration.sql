-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "hashedPassword" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMPTZ,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'User',
    "knowledgeBasesMinScore" DOUBLE PRECISION,
    "knowledgeBasesMaxResults" INTEGER,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "token_type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expires_at" INTEGER NOT NULL,
    "ext_expires_in" INTEGER,
    "refresh_expires_in" INTEGER,
    "refresh_token" TEXT,
    "access_token" TEXT NOT NULL,
    "id_token" TEXT NOT NULL,
    "session_state" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VerificationRequest" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Prompt" (
    "id" UUID NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "randomness" DOUBLE PRECISION NOT NULL,
    "repetitiveness" DOUBLE PRECISION NOT NULL,
    "bestOf" INTEGER,
    "frequencyPenalty" DOUBLE PRECISION,
    "presencePenalty" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "creatorId" UUID,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromptTag" (
    "promptId" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "PromptTag_pkey" PRIMARY KEY ("promptId","tag")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromptBookmark" (
    "userId" UUID NOT NULL,
    "promptId" UUID NOT NULL,

    CONSTRAINT "PromptBookmark_pkey" PRIMARY KEY ("userId","promptId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LogEntry" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "context" JSONB,
    "prompt" TEXT NOT NULL,
    "config" JSONB,
    "result" TEXT,
    "error" TEXT,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiProvider" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Unlabeled AI Provider',
    "aiProviderTypeId" INTEGER NOT NULL,
    "apiConfigType" INTEGER NOT NULL,
    "apiConfigId" UUID NOT NULL,
    "costPerInputToken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerOutputToken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Model" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT NOT NULL DEFAULT '',
    "costPerInputToken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerOutputToken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiProviderId" UUID NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApiConfigOpenAi" (
    "id" UUID NOT NULL,
    "apiKey" TEXT NOT NULL,
    "orgKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "ApiConfigOpenAi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApiConfigAzureOpenAi" (
    "id" UUID NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiEndpoint" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "ApiConfigAzureOpenAi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApiConfigAnthropic" (
    "id" UUID NOT NULL,
    "apiKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "ApiConfigAnthropic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApiConfigGemini" (
    "id" UUID NOT NULL,
    "apiKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "ApiConfigGemini_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApiConfigBedrock" (
    "id" UUID NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "secretAccessKey" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "ApiConfigBedrock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KbProvider" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "kbProviderType" INTEGER NOT NULL,
    "writeAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "KbProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KnowledgeBase" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "kbProviderId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserGroup" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "joinCode" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "UserGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserGroupMembership" (
    "userGroupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "UserGroupMembership_pkey" PRIMARY KEY ("userGroupId","userId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiProviderUsage" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "aiProviderId" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "inputTokensUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerInputToken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputTokensUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerOutputToken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AiProviderUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Chat" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "modelId" UUID,
    "promptId" UUID,
    "summary" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatMessageCitation" (
    "id" UUID NOT NULL,
    "citation" TEXT NOT NULL,
    "chatMessageId" UUID NOT NULL,
    "knowledgeBaseId" UUID NOT NULL,

    CONSTRAINT "ChatMessageCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatArtifact" (
    "id" UUID NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chatMessageId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Embedding" (
    "id" UUID NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "content" TEXT NOT NULL,
    "contentNum" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "id" UUID NOT NULL,
    "systemMessage" TEXT NOT NULL DEFAULT 'Persona: You are a helpful assistant.',
    "termsOfUseHeader" TEXT NOT NULL DEFAULT 'Generative AI Use Acknowledgment',
    "termsOfUseBody" TEXT NOT NULL DEFAULT 'Please be aware that it is crucial to only utilize non-sensitive information when using AI-powered applications such as PALM. Users are fully responsible for all application usage and the data shared when using features that send such data to third-party APIs (AI providers). Do not input any sensitive or classified data. If you are unsure whether data is sensitive or classified, consult your organization''s policies before proceeding.',
    "termsOfUseCheckboxLabel" TEXT NOT NULL DEFAULT 'I agree to the terms of use',
    "legalPolicyHeader" TEXT NOT NULL DEFAULT 'Legal Policy',
    "legalPolicyBody" TEXT NOT NULL DEFAULT 'All Rights Reserved.',
    "defaultUserGroupId" UUID,
    "systemAiProviderModelId" UUID,
    "featureManagementPromptGenerator" BOOLEAN NOT NULL DEFAULT true,
    "featureManagementChatSummarization" BOOLEAN NOT NULL DEFAULT true,
    "featureManagementPromptTagSuggestions" BOOLEAN NOT NULL DEFAULT true,
    "documentLibraryKbProviderId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditRecord" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "referer" TEXT,
    "outcome" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "event" TEXT NOT NULL DEFAULT '',
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiAgent" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AiAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentCertaPolicy" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "aiAgentId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AgentCertaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PersonalDocument" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadStatus" TEXT NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "PersonalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AiProviderToUserGroup" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AiProviderToUserGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_KbProviderToUserGroup" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_KbProviderToUserGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_KnowledgeBaseToUser" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_KnowledgeBaseToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_ChatMessageToEmbedding" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ChatMessageToEmbedding_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AiAgentToUserGroup" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AiAgentToUserGroup_AB_pkey" PRIMARY KEY ("A","B")
);

DO $$
BEGIN
    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'User_email_key') THEN
        CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Account_provider_providerAccountId_key') THEN
        CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'VerificationRequest_token_key') THEN
        CREATE UNIQUE INDEX "VerificationRequest_token_key" ON "VerificationRequest"("token");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'VerificationRequest_identifier_token_key') THEN
        CREATE UNIQUE INDEX "VerificationRequest_identifier_token_key" ON "VerificationRequest"("identifier", "token");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Prompt_slug_key') THEN
        CREATE UNIQUE INDEX "Prompt_slug_key" ON "Prompt"("slug");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'PromptTag_tag_idx') THEN
        CREATE INDEX "PromptTag_tag_idx" ON "PromptTag"("tag");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Model_aiProviderId_idx') THEN
        CREATE INDEX "Model_aiProviderId_idx" ON "Model"("aiProviderId");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'KnowledgeBase_kbProviderId_idx') THEN
        CREATE INDEX "KnowledgeBase_kbProviderId_idx" ON "KnowledgeBase"("kbProviderId");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'UserGroup_label_key') THEN
        CREATE UNIQUE INDEX "UserGroup_label_key" ON "UserGroup"("label");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'UserGroup_joinCode_key') THEN
        CREATE UNIQUE INDEX "UserGroup_joinCode_key" ON "UserGroup"("joinCode");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Chat_userId_createdAt_idx') THEN
        CREATE INDEX "Chat_userId_createdAt_idx" ON "Chat"("userId", "createdAt");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Chat_modelId_idx') THEN
        CREATE INDEX "Chat_modelId_idx" ON "Chat"("modelId");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Chat_promptId_idx') THEN
        CREATE INDEX "Chat_promptId_idx" ON "Chat"("promptId");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ChatMessage_chatId_createdAt_idx') THEN
        CREATE INDEX "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'SystemConfig_defaultUserGroupId_key') THEN
        CREATE UNIQUE INDEX "SystemConfig_defaultUserGroupId_key" ON "SystemConfig"("defaultUserGroupId");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'SystemConfig_documentLibraryKbProviderId_key') THEN
        CREATE UNIQUE INDEX "SystemConfig_documentLibraryKbProviderId_key" ON "SystemConfig"("documentLibraryKbProviderId");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'AiAgent_name_key') THEN
        CREATE UNIQUE INDEX "AiAgent_name_key" ON "AiAgent"("name");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'AgentCertaPolicy_title_key') THEN
        CREATE UNIQUE INDEX "AgentCertaPolicy_title_key" ON "AgentCertaPolicy"("title");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_AiProviderToUserGroup_AB_unique') THEN
        CREATE UNIQUE INDEX "_AiProviderToUserGroup_AB_unique" ON "_AiProviderToUserGroup"("A", "B");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_AiProviderToUserGroup_B_index') THEN
        CREATE INDEX "_AiProviderToUserGroup_B_index" ON "_AiProviderToUserGroup"("B");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_KbProviderToUserGroup_AB_unique') THEN
        CREATE UNIQUE INDEX "_KbProviderToUserGroup_AB_unique" ON "_KbProviderToUserGroup"("A", "B");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_KbProviderToUserGroup_B_index') THEN
        CREATE INDEX "_KbProviderToUserGroup_B_index" ON "_KbProviderToUserGroup"("B");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_KnowledgeBaseToUser_AB_unique') THEN
        CREATE UNIQUE INDEX "_KnowledgeBaseToUser_AB_unique" ON "_KnowledgeBaseToUser"("A", "B");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_KnowledgeBaseToUser_B_index') THEN
        CREATE INDEX "_KnowledgeBaseToUser_B_index" ON "_KnowledgeBaseToUser"("B");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_ChatMessageToEmbedding_AB_unique') THEN
        CREATE UNIQUE INDEX "_ChatMessageToEmbedding_AB_unique" ON "_ChatMessageToEmbedding"("A", "B");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_ChatMessageToEmbedding_B_index') THEN
        CREATE INDEX "_ChatMessageToEmbedding_B_index" ON "_ChatMessageToEmbedding"("B");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_AiAgentToUserGroup_AB_unique') THEN
        CREATE UNIQUE INDEX "_AiAgentToUserGroup_AB_unique" ON "_AiAgentToUserGroup"("A", "B");
    END IF;

    -- CreateIndex
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_AiAgentToUserGroup_B_index') THEN
        CREATE INDEX "_AiAgentToUserGroup_B_index" ON "_AiAgentToUserGroup"("B");
    END IF;
END $$;

DO $$
BEGIN
    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey') THEN
        ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prompt_creatorId_fkey') THEN
        ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromptTag_promptId_fkey') THEN
        ALTER TABLE "PromptTag" ADD CONSTRAINT "PromptTag_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromptBookmark_userId_fkey') THEN
        ALTER TABLE "PromptBookmark" ADD CONSTRAINT "PromptBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromptBookmark_promptId_fkey') THEN
        ALTER TABLE "PromptBookmark" ADD CONSTRAINT "PromptBookmark_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Model_aiProviderId_fkey') THEN
        ALTER TABLE "Model" ADD CONSTRAINT "Model_aiProviderId_fkey" FOREIGN KEY ("aiProviderId") REFERENCES "AiProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeBase_kbProviderId_fkey') THEN
        ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_kbProviderId_fkey" FOREIGN KEY ("kbProviderId") REFERENCES "KbProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserGroupMembership_userGroupId_fkey') THEN
        ALTER TABLE "UserGroupMembership" ADD CONSTRAINT "UserGroupMembership_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserGroupMembership_userId_fkey') THEN
        ALTER TABLE "UserGroupMembership" ADD CONSTRAINT "UserGroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiProviderUsage_userId_fkey') THEN
        ALTER TABLE "AiProviderUsage" ADD CONSTRAINT "AiProviderUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiProviderUsage_aiProviderId_fkey') THEN
        ALTER TABLE "AiProviderUsage" ADD CONSTRAINT "AiProviderUsage_aiProviderId_fkey" FOREIGN KEY ("aiProviderId") REFERENCES "AiProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiProviderUsage_modelId_fkey') THEN
        ALTER TABLE "AiProviderUsage" ADD CONSTRAINT "AiProviderUsage_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Chat_userId_fkey') THEN
        ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Chat_modelId_fkey') THEN
        ALTER TABLE "Chat" ADD CONSTRAINT "Chat_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Chat_promptId_fkey') THEN
        ALTER TABLE "Chat" ADD CONSTRAINT "Chat_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_chatId_fkey') THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessageCitation_chatMessageId_fkey') THEN
        ALTER TABLE "ChatMessageCitation" ADD CONSTRAINT "ChatMessageCitation_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessageCitation_knowledgeBaseId_fkey') THEN
        ALTER TABLE "ChatMessageCitation" ADD CONSTRAINT "ChatMessageCitation_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatArtifact_chatMessageId_fkey') THEN
        ALTER TABLE "ChatArtifact" ADD CONSTRAINT "ChatArtifact_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SystemConfig_defaultUserGroupId_fkey') THEN
        ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_defaultUserGroupId_fkey" FOREIGN KEY ("defaultUserGroupId") REFERENCES "UserGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SystemConfig_systemAiProviderModelId_fkey') THEN
        ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_systemAiProviderModelId_fkey" FOREIGN KEY ("systemAiProviderModelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SystemConfig_documentLibraryKbProviderId_fkey') THEN
        ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_documentLibraryKbProviderId_fkey" FOREIGN KEY ("documentLibraryKbProviderId") REFERENCES "KbProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditRecord_userId_fkey') THEN
        ALTER TABLE "AuditRecord" ADD CONSTRAINT "AuditRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentCertaPolicy_aiAgentId_fkey') THEN
        ALTER TABLE "AgentCertaPolicy" ADD CONSTRAINT "AgentCertaPolicy_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PersonalDocument_userId_fkey') THEN
        ALTER TABLE "PersonalDocument" ADD CONSTRAINT "PersonalDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_AiProviderToUserGroup_A_fkey') THEN
        ALTER TABLE "_AiProviderToUserGroup" ADD CONSTRAINT "_AiProviderToUserGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "AiProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_AiProviderToUserGroup_B_fkey') THEN
        ALTER TABLE "_AiProviderToUserGroup" ADD CONSTRAINT "_AiProviderToUserGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_KbProviderToUserGroup_A_fkey') THEN
        ALTER TABLE "_KbProviderToUserGroup" ADD CONSTRAINT "_KbProviderToUserGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "KbProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_KbProviderToUserGroup_B_fkey') THEN
        ALTER TABLE "_KbProviderToUserGroup" ADD CONSTRAINT "_KbProviderToUserGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_KnowledgeBaseToUser_A_fkey') THEN
        ALTER TABLE "_KnowledgeBaseToUser" ADD CONSTRAINT "_KnowledgeBaseToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_KnowledgeBaseToUser_B_fkey') THEN
        ALTER TABLE "_KnowledgeBaseToUser" ADD CONSTRAINT "_KnowledgeBaseToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ChatMessageToEmbedding_A_fkey') THEN
        ALTER TABLE "_ChatMessageToEmbedding" ADD CONSTRAINT "_ChatMessageToEmbedding_A_fkey" FOREIGN KEY ("A") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ChatMessageToEmbedding_B_fkey') THEN
        ALTER TABLE "_ChatMessageToEmbedding" ADD CONSTRAINT "_ChatMessageToEmbedding_B_fkey" FOREIGN KEY ("B") REFERENCES "Embedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_AiAgentToUserGroup_A_fkey') THEN
        ALTER TABLE "_AiAgentToUserGroup" ADD CONSTRAINT "_AiAgentToUserGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- AddForeignKey
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_AiAgentToUserGroup_B_fkey') THEN
        ALTER TABLE "_AiAgentToUserGroup" ADD CONSTRAINT "_AiAgentToUserGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Manually add data
INSERT INTO "AiAgent" ("id", "name", "description", "enabled", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Compliance Evaluation, Reporting, and Tracking Agent (CERTA)',
  'Use the power of AI to ensure your website is compliant with all specified policies',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
  );
