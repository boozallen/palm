/**
 * System Configuration Script
 * 
 * Usage: ts-node prisma/scripts/configure-system-settings.ts [options]
 *
 * Required:
 *   userEmail=<email>                  Email of the user to associate providers with
 *
 * User Group Options:
 *   userGroupLabel=<label>             Label for user group (default: "Test Group #1")
 *   userGroup2Label=<label>            Label for a second user group the user joins as a member (default: "Test Group #2")
 *
 * Bedrock Provider Options:
 *   bedrockLabel=<label>               Label for Bedrock provider (default: "Bedrock")
 *   bedrockAccessKeyId=<key>           AWS Access Key ID
 *   bedrockSecretAccessKey=<key>       AWS Secret Access Key
 *   bedrockSessionToken=<token>        AWS Session Token (default: "")
 *   bedrockRegion=<region>             AWS Region (default: "us-east-1")
 *   bedrockModelId=<model>             Bedrock model ID (default: "global.anthropic.claude-sonnet-4-5-20250929-v1:0")
 *   bedrockModelLabel=<label>          Bedrock model label (default: same as modelId)
 *
 * Document Upload Provider Options:
 *   docUploadLabel=<label>             Label for document upload provider (default: "AWS (S3)")
 *   docUploadAccessKeyId=<key>         AWS Access Key ID for S3
 *   docUploadSecretAccessKey=<key>     AWS Secret Access Key for S3
 *   docUploadSessionToken=<token>      AWS Session Token for S3 (default: "")
 *   docUploadRegion=<region>           AWS Region for S3 (default: "us-east-1")
 *   docUploadS3Uri=<uri>               S3 URI for document storage (e.g., s3://bucket-name)
 *
 * Agent Provider Options:
 *   agentProviderName=<name>           Name for the agent provider (default: "Default Agent Provider")
 *   agentProviderEndpoint=<url>        HTTP endpoint for the agent provider (required to create agent provider)
 *   agentProviderApiKey=<key>          API key for the agent provider (optional)
 *   agentProviderDescription=<text>    Description for the agent provider (default: "")
 *
 * GitHub Provider Options:
 *   githubAccessToken=<token>          GitHub Personal Access Token with repo scope (required to create GitHub provider)
 *   githubApiBaseUrl=<url>             GitHub API base URL (default: "https://api.github.com"; use "https://<host>/api/v3" for GHE)
 *   githubOwner=<owner>                GitHub organization or user that owns the target repository
 *   githubRepo=<repo>                  GitHub repository name to push artifacts to
 *   githubLabel=<label>                Label for the GitHub provider (default: "GitHub Artifacts")
 *   githubDescription=<text>           Description for the GitHub provider (default: "")
 *
 * Examples:
 *   # Setup Bedrock provider
 *   ts-node prisma/scripts/configure-system-settings.ts userEmail=admin@example.com bedrockAccessKeyId=AKIA... bedrockSecretAccessKey=abc123
 *
 *   # Setup Bedrock with custom user group
 *   ts-node prisma/scripts/configure-system-settings.ts userEmail=admin@example.com userGroupLabel="AI Team" bedrockAccessKeyId=AKIA... bedrockSecretAccessKey=abc123 bedrockRegion=us-west-2
 *
 * What this script does:
 *   1. Updates the specified user to Admin role
 *   2. Creates Bedrock AI provider with multiple models (Claude Opus 4.6, Claude Sonnet 4.5, Claude Haiku 4.5)
 *   3. Sets Claude Sonnet 4.5 as the system default AI model and knowledge graph AI model
 *   4. Creates document upload provider (AWS S3) if credentials provided
 *   5. Creates a user group (or uses existing one) and adds the user as Lead
 *   6. Enables the AI provider for the user group
 *   7. Enables Neo4j graph database for the user group
 *   8. Enables workflows for the user group
 *   9. Enables context studio for the user group
 *   10. Enables agentic chat for the user group
 *   11. Creates reusable Prompt records and an example workflow that references them via promptId
 *   12. Creates an agent provider (if endpoint provided) and enables it for the user group
 *   13. Creates a GitHub provider (if githubAccessToken provided) and enables it for the user group
 *   14. Creates a second user group (or uses existing one) and adds the user as a member (no preset AI provider access)

 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { createAuditor, type Auditor } from '../../server/auditor';
import { AiProviderType } from '../../features/shared/types/ai-provider';
import { DocumentUploadProviderType } from '../../features/shared/types/document-upload-provider';
import { PrimitiveType } from '../../features/workflows/types/primitive';
import { sanitizeForPostgres } from '../../features/workflows/utils/sanitize';
import { AuditRecordEvent, AuditRecordOutcome } from '../../features/shared/types/audit-record';
import {
  BEDROCK_TITAN_EMBEDDING_MODEL,
  BEDROCK_TITAN_EMBEDDING_MODEL_NAME,
  BEDROCK_TITAN_EMBEDDING_COST_PER_INPUT_TOKEN,
  BEDROCK_TITAN_EMBEDDING_COST_PER_OUTPUT_TOKEN,
} from '@/features/shared/constants/bedrock';

const prisma = new PrismaClient();

interface ProviderConfig {
  // Set current User role to Admin
  userEmail: string;
  // User Group configuration
  userGroupLabel?: string;
  userGroup2Label?: string;
  // AI Provider configuration
  bedrockLabel?: string;
  bedrockAccessKeyId?: string;
  bedrockSecretAccessKey?: string;
  bedrockSessionToken?: string;
  bedrockRegion?: string;
  // Document Upload Provider configuration
  docUploadLabel?: string;
  docUploadAccessKeyId?: string;
  docUploadSecretAccessKey?: string;
  docUploadSessionToken?: string;
  docUploadRegion?: string;
  docUploadS3Uri?: string;
  // Agent Provider configuration
  agentProviderName?: string;
  agentProviderEndpoint?: string;
  agentProviderApiKey?: string;
  agentProviderDescription?: string;
  // GitHub Provider configuration
  githubAccessToken?: string;
  githubApiBaseUrl?: string;
  githubOwner?: string;
  githubRepo?: string;
  githubLabel?: string;
  githubDescription?: string;
}

function parseArguments(): ProviderConfig {
  const config: ProviderConfig = {
    userEmail: '',
  };

  // Parse command line arguments in key=value format
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const [key, value] = arg.split('=');

    if (!key || !value) {
      console.log(`Skipping invalid argument: ${arg}`);
      continue;
    }

    switch (key.toLowerCase()) {
      case 'useremail':
        config.userEmail = value;
        break;
      case 'usergrouplabel':
        config.userGroupLabel = value;
        break;
      case 'usergroup2label':
        config.userGroup2Label = value;
        break;
      case 'bedrocklabel':
        config.bedrockLabel = value;
        break;
      case 'bedrockaccesskeyid':
        config.bedrockAccessKeyId = value;
        break;
      case 'bedrocksecretaccesskey':
        config.bedrockSecretAccessKey = value;
        break;
      case 'bedrocksessiontoken':
        config.bedrockSessionToken = value;
        break;
      case 'bedrockregion':
        config.bedrockRegion = value;
        break;
      case 'docuploadlabel':
        config.docUploadLabel = value;
        break;
      case 'docuploadaccesskeyid':
        config.docUploadAccessKeyId = value;
        break;
      case 'docuploadsecretaccesskey':
        config.docUploadSecretAccessKey = value;
        break;
      case 'docuploadsessiontoken':
        config.docUploadSessionToken = value;
        break;
      case 'docuploadregion':
        config.docUploadRegion = value;
        break;
      case 'docuploads3uri':
        config.docUploadS3Uri = value;
        break;
      case 'agentprovidername':
        config.agentProviderName = value;
        break;
      case 'agentproviderendpoint':
        config.agentProviderEndpoint = value;
        break;
      case 'agentproviderapikey':
        config.agentProviderApiKey = value;
        break;
      case 'agentproviderdescription':
        config.agentProviderDescription = value;
        break;
      case 'githubaccesstoken':
        config.githubAccessToken = value;
        break;
      case 'githubapibaseurl':
        config.githubApiBaseUrl = value;
        break;
      case 'githubowner':
        config.githubOwner = value;
        break;
      case 'githubrepo':
        config.githubRepo = value;
        break;
      case 'githublabel':
        config.githubLabel = value;
        break;
      case 'githubdescription':
        config.githubDescription = value;
        break;
      default:
        console.warn(`Unknown argument: ${key}`);
    }
  }

  console.log('Configuration values:', {
    userEmail: config.userEmail,
    hasBedrock: !!(config.bedrockAccessKeyId && config.bedrockSecretAccessKey),
    hasDocUpload: !!(config.docUploadAccessKeyId && config.docUploadSecretAccessKey && config.docUploadS3Uri),
    hasGitHub: !!config.githubAccessToken,
    bedrockAccessKeyId: config.bedrockAccessKeyId ? 'PROVIDED' : 'MISSING',
    bedrockSecretAccessKey: config.bedrockSecretAccessKey ? 'PROVIDED' : 'MISSING',
    docUploadAccessKeyId: config.docUploadAccessKeyId ? 'PROVIDED' : 'MISSING',
    docUploadSecretAccessKey: config.docUploadSecretAccessKey ? 'PROVIDED' : 'MISSING',
    docUploadS3Uri: config.docUploadS3Uri || 'MISSING',
    githubAccessToken: config.githubAccessToken ? 'PROVIDED' : 'MISSING',
    githubApiBaseUrl: config.githubApiBaseUrl || 'https://api.github.com',
  });

  return config;
}

async function promoteUserToAdmin(userEmail: string, auditor: Auditor): Promise<void> {
  console.log('Promoting user to Admin role...');

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { name: true, role: true },
  });

  await prisma.user.update({
    where: { email: userEmail },
    data: { role: 'Admin' },
  });

  auditor.createAuditRecord({
    outcome: AuditRecordOutcome.Success,
    description: `User ${user?.name} (${userEmail}) role updated from ${user?.role} to Admin`,
    event: AuditRecordEvent.ModifyUserRole,
  });
}

async function findOrCreateUserGroup(
  userGroupLabel: string,
  userId: string,
  role: 'Lead' | 'User',
  auditor: Auditor,
): Promise<string> {
  const roleDescription = role === 'Lead' ? 'Lead' : 'a member';

  console.log(`Looking up user group: ${userGroupLabel}...`);

  // Get user info for audit logging
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  // Check if user group already exists
  let userGroup = await prisma.userGroup.findFirst({
    where: { label: userGroupLabel, deletedAt: null },
    include: {
      userGroupMemberships: {
        where: { userId },
      },
    },
  });

  if (userGroup) {
    console.log(`User group '${userGroupLabel}' already exists`);

    // Check if user is already a member
    if (userGroup.userGroupMemberships.length === 0) {
      console.log(`Adding user to existing group as ${roleDescription}...`);
      await prisma.userGroupMembership.create({
        data: {
          userId,
          userGroupId: userGroup.id,
          role,
        },
      });

      auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${user?.name} (${user?.email}) was added as ${roleDescription} to existing user group '${userGroupLabel}'`,
        event: AuditRecordEvent.CreateUserGroupMembership,
      });

      console.log('User added to group');
    } else {
      console.log('User already member of group');
    }
  } else {
    console.log(`Creating new user group: ${userGroupLabel}...`);
    userGroup = await prisma.userGroup.create({
      data: {
        label: userGroupLabel,
        userGroupMemberships: {
          create: {
            userId,
            role,
          },
        },
      },
      include: {
        userGroupMemberships: true,
      },
    });

    auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      description: `User group '${userGroupLabel}' created with user ${user?.name} (${user?.email}) as ${roleDescription}`,
      event: AuditRecordEvent.CreateUserGroup,
    });
  }

  return userGroup.id;
}

async function createOrGetUserGroup(config: ProviderConfig, userId: string, auditor: Auditor): Promise<string[]> {
  const userGroupLabel = config.userGroupLabel || 'Test Group #1';
  const userGroupId = await findOrCreateUserGroup(userGroupLabel, userId, 'Lead', auditor);

  // Enable neo4j graph database for the user group
  await enableNeo4jForUserGroup(userGroupId);

  // Enable workflows for the user group
  await enableWorkflowsForUserGroup(userGroupId);

  // Enable context studio for the user group
  await enableContextStudioForUserGroup(userGroupId);

  // Enable agentic chat for the user group
  await enableAgenticChatForUserGroup(userGroupId);

  return [userGroupId];
}

async function createOrGetSecondaryUserGroup(config: ProviderConfig, userId: string, auditor: Auditor): Promise<string> {
  const userGroupLabel = config.userGroup2Label || 'Test Group #2';
  return findOrCreateUserGroup(userGroupLabel, userId, 'User', auditor);
}

async function enableNeo4jForUserGroup(userGroupId: string): Promise<void> {
  console.log('Enabling Neo4j graph database for user group...');

  try {
    // Check if user group already has graph database enabled
    const existingUserGroup = await prisma.userGroup.findUnique({
      where: { id: userGroupId },
      select: { graphDatabaseEnabled: true },
    });

    if (existingUserGroup?.graphDatabaseEnabled) {
      console.log('Neo4j graph database is already enabled for this user group');
      return;
    }

    // Enable graph database for the user group
    await prisma.userGroup.update({
      where: { id: userGroupId },
      data: { graphDatabaseEnabled: true },
    });

    console.log('✅ Neo4j graph database enabled for user group');
  } catch (error) {
    console.error('Failed to enable Neo4j graph database:', error);
    // Don't throw the error to avoid breaking the entire setup process
    console.log('⚠️  Neo4j enablement failed, but continuing with setup...');
  }
}

async function enableWorkflowsForUserGroup(userGroupId: string): Promise<void> {
  console.log('Enabling workflows for user group...');

  try {
    // Check if user group already has workflows enabled
    const existingUserGroup = await prisma.userGroup.findUnique({
      where: { id: userGroupId },
      select: { workflowsEnabled: true },
    });

    if (existingUserGroup?.workflowsEnabled) {
      console.log('Workflows are already enabled for this user group');
      return;
    }

    // Enable workflows for the user group
    await prisma.userGroup.update({
      where: { id: userGroupId },
      data: { workflowsEnabled: true },
    });

    console.log('✅ Workflows enabled for user group');
  } catch (error) {
    console.error('Failed to enable workflows:', error);
    // Don't throw the error to avoid breaking the entire setup process
    console.log('⚠️  Workflows enablement failed, but continuing with setup...');
  }
}

async function enableContextStudioForUserGroup(userGroupId: string): Promise<void> {
  console.log('Enabling context studio for user group...');

  try {
    // Check if user group already has context studio enabled
    const existingUserGroup = await prisma.userGroup.findUnique({
      where: { id: userGroupId },
      select: { contextStudioEnabled: true },
    });

    if (existingUserGroup?.contextStudioEnabled) {
      console.log('Context studio is already enabled for this user group');
      return;
    }

    // Enable context studio for the user group
    await prisma.userGroup.update({
      where: { id: userGroupId },
      data: { contextStudioEnabled: true },
    });

    console.log('✅ Context studio enabled for user group');
  } catch (error) {
    console.error('Failed to enable context studio:', error);
    // Don't throw the error to avoid breaking the entire setup process
    console.log('⚠️  Context studio enablement failed, but continuing with setup...');
  }
}

async function enableAgenticChatForUserGroup(userGroupId: string): Promise<void> {
  console.log('Enabling agentic chat for user group...');

  try {
    // Check if user group already has agentic chat enabled
    const existingUserGroup = await prisma.userGroup.findUnique({
      where: { id: userGroupId },
      select: { agenticChatEnabled: true },
    });

    if (existingUserGroup?.agenticChatEnabled) {
      console.log('Agentic chat is already enabled for this user group');
      return;
    }

    // Enable agentic chat for the user group
    await prisma.userGroup.update({
      where: { id: userGroupId },
      data: { agenticChatEnabled: true },
    });

    console.log('✅ Agentic chat enabled for user group');
  } catch (error) {
    console.error('Failed to enable agentic chat:', error);
    // Don't throw the error to avoid breaking the entire setup process
    console.log('⚠️  Agentic chat enablement failed, but continuing with setup...');
  }
}

async function setupBedrockProvider(config: ProviderConfig): Promise<{ providerId: string; modelId: string } | null> {
  if (!config.bedrockAccessKeyId || !config.bedrockSecretAccessKey) {
    console.log('Skipping Bedrock provider setup (missing access credentials)');
    return null;
  }

  // Create API config for Bedrock
  const bedrockConfig = await prisma.apiConfigBedrock.create({
    data: {
      accessKeyId: config.bedrockAccessKeyId,
      secretAccessKey: config.bedrockSecretAccessKey,
      sessionToken: config.bedrockSessionToken || '',
      region: config.bedrockRegion || 'us-east-1',
    },
  });

  // Create AI Provider (without user groups for now)
  const bedrockProvider = await prisma.aiProvider.create({
    data: {
      label: config.bedrockLabel || 'Bedrock',
      aiProviderTypeId: AiProviderType.Bedrock,
      apiConfigType: AiProviderType.Bedrock,
      apiConfigId: bedrockConfig.id,
    },
  });

  // Create multiple Bedrock models. embeddingsOnly omitted for chat models takes
  // the schema default (false).
  const models: Array<{
    name: string;
    externalId: string;
    costPerInputToken?: number;
    costPerOutputToken?: number;
    embeddingsOnly?: boolean;
  }> = [
    {
      name: 'Claude Opus 4.6',
      externalId: 'us.anthropic.claude-opus-4-6-v1',
      costPerInputToken: 0.000005, // $5 / MTok
      costPerOutputToken: 0.000025, // $25 / MTok
    },
    {
      name: 'Claude Sonnet 4.5',
      externalId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      costPerInputToken: 0.000003, // $3 / MTok
      costPerOutputToken: 0.000015, // $15 / MTok
    },
    {
      name: 'Claude Haiku 4.5',
      externalId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      costPerInputToken: 0.000001, // $1 / MTok
      costPerOutputToken: 0.000005, // $5 / MTok
    },
    // Seeded already designated so a fresh local install can upload documents
    // without an admin having to tick the checkbox first. Providers added through
    // Settings get no model at all; every model there, this one included, is
    // hand-configured and designated from the provider table.
    {
      name: BEDROCK_TITAN_EMBEDDING_MODEL_NAME,
      externalId: BEDROCK_TITAN_EMBEDDING_MODEL,
      costPerInputToken: BEDROCK_TITAN_EMBEDDING_COST_PER_INPUT_TOKEN,
      costPerOutputToken: BEDROCK_TITAN_EMBEDDING_COST_PER_OUTPUT_TOKEN,
      embeddingsOnly: true,
    },
  ];

  let defaultModelId: string = '';

  // Create all models
  for (const model of models) {
    const createdModel = await prisma.model.create({
      data: {
        name: model.name,
        externalId: model.externalId,
        costPerInputToken: model.costPerInputToken,
        costPerOutputToken: model.costPerOutputToken,
        embeddingsOnly: model.embeddingsOnly,
        aiProviderId: bedrockProvider.id,
      },
    });

    // Set Claude Sonnet 4.5 as the default model
    if (model.name === 'Claude Sonnet 4.5') {
      defaultModelId = createdModel.id;
    }
  }

  console.log('Bedrock provider setup complete with multiple models');
  return { providerId: bedrockProvider.id, modelId: defaultModelId };
}

async function setupDocumentUploadProvider(config: ProviderConfig): Promise<string | null> {
  if (!config.docUploadAccessKeyId || !config.docUploadSecretAccessKey || !config.docUploadS3Uri) {
    console.log('Skipping Document Upload provider setup (missing credentials or S3 URI)');
    return null;
  }

  // Create Document Upload Provider
  const docUploadProvider = await prisma.documentUploadProvider.create({
    data: {
      label: config.docUploadLabel || 'AWS (S3)',
      type: DocumentUploadProviderType.AWS,
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: config.docUploadAccessKeyId,
        secretAccessKey: config.docUploadSecretAccessKey,
        sessionToken: config.docUploadSessionToken || '',
        region: config.docUploadRegion || 'us-east-1',
        s3Uri: config.docUploadS3Uri,
      },
    },
  });

  console.log('Document Upload provider (AWS S3) setup complete');
  return docUploadProvider.id;
}

async function setupAgentProvider(config: ProviderConfig, userGroupIds: string[]): Promise<string | null> {
  if (!config.agentProviderEndpoint) {
    console.log('Skipping agent provider setup (no agentProviderEndpoint provided)');
    return null;
  }

  console.log('Setting up agent provider...');

  const agentProvider = await prisma.agentProvider.create({
    data: {
      name: config.agentProviderName || 'Default Agent Provider',
      description: config.agentProviderDescription || '',
      endpoint: config.agentProviderEndpoint,
      apiKey: config.agentProviderApiKey || null,
      userGroups: {
        connect: userGroupIds.map((id) => ({ id })),
      },
    },
  });

  console.log(`✅ Agent provider '${agentProvider.name}' created and enabled for user group`);
  return agentProvider.id;
}

async function createExampleWorkflow(userId: string, userGroupIds: string[], defaultModelId: string): Promise<void> {
  console.log('Creating example workflow...');

  try {
    // Check if example workflow already exists
    const existingWorkflow = await prisma.workflow.findFirst({
      where: {
        name: 'Example Workflow',
        createdBy: userId,
      },
    });

    if (existingWorkflow) {
      console.log('Example workflow already exists, skipping creation');
      return;
    }

    // Create reusable Prompt records that can be referenced by workflow primitives
    const prompt1 = await prisma.prompt.create({
      data: {
        title: 'Say Hello',
        summary: 'A simple prompt that greets the user',
        description: 'This prompt generates a friendly hello message',
        instructions: 'Say hello to the user in a friendly and welcoming way.',
        example: 'Hello! Welcome to our workflow system!',
        model: defaultModelId,
        temperature: 0.7,
        topP: 1.0,
        creatorId: userId,
        workflows: true,
      },
    });

    const prompt2 = await prisma.prompt.create({
      data: {
        title: 'Say Hello Back',
        summary: 'A prompt that responds to a greeting',
        description: 'This prompt generates a response to a hello message',
        instructions: 'Respond warmly to the previous greeting and express enthusiasm about working together.',
        example: 'Hello! It\'s great to connect with you! I\'m excited to help you build amazing workflows.',
        model: defaultModelId,
        temperature: 0.7,
        topP: 1.0,
        creatorId: userId,
        workflows: true,
      },
    });

    console.log('Example prompts created');

    // Create workflow primitives: two prompt nodes and one artifact node
    const promptNode1Id = crypto.randomUUID();
    const promptNode2Id = crypto.randomUUID();
    const artifactNodeId = crypto.randomUUID();

    const primitives = [
      {
        id: promptNode1Id,
        type: PrimitiveType.PROMPT,
        name: 'Say Hello',
        config: {
          model: defaultModelId,
          promptId: prompt1.id,
          temperature: 0.7,
        },
        position: { x: 180, y: 20 },
        predecessorIds: [],
      },
      {
        id: promptNode2Id,
        type: PrimitiveType.PROMPT,
        name: 'Say Hello Back',
        config: {
          model: defaultModelId,
          promptId: prompt2.id,
          temperature: 0.7,
        },
        position: { x: 180, y: 140 },
        predecessorIds: [promptNode1Id],
      },
      {
        id: artifactNodeId,
        type: PrimitiveType.ARTIFACT,
        name: 'Generate Document',
        config: {
          format: '.docx',
          filename: 'document',
        },
        position: { x: 180, y: 260 },
        predecessorIds: [promptNode2Id],
      },
    ];

    const definition = {
      id: crypto.randomUUID(),
      name: 'Example Workflow',
      description: 'A simple example workflow with two prompt nodes and an artifact node',
      version: '1.0.0',
      primitives,
      viewport: { x: 0, y: 0, zoom: 1 },
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await prisma.workflow.create({
      data: {
        name: 'Example Workflow',
        description: 'A simple example workflow with two prompt nodes and an artifact node',
        version: '1.0.0',
        definition: sanitizeForPostgres(definition) as any,
        createdBy: userId,
        userGroups: {
          connect: userGroupIds.map((id) => ({ id })),
        },
      },
    });

    console.log('✅ Example workflow created successfully');
  } catch (error) {
    console.error('Failed to create example workflow:', error);
    console.log('⚠️  Example workflow creation failed, but continuing with setup...');
  }
}

async function setupGitHubProvider(config: ProviderConfig, userGroupIds: string[]): Promise<string | null> {
  if (!config.githubAccessToken) {
    console.log('Skipping GitHub provider setup (no githubAccessToken provided)');
    return null;
  }

  console.log('Setting up GitHub provider...');

  const provider = await prisma.gitHubProvider.create({
    data: {
      label: config.githubLabel || 'GitHub Artifacts',
      accessToken: config.githubAccessToken,
      apiBaseUrl: config.githubApiBaseUrl || 'https://api.github.com',
      owner: config.githubOwner || '',
      repo: config.githubRepo || '',
      description: config.githubDescription || '',
      userGroups: {
        connect: userGroupIds.map((id) => ({ id })),
      },
    },
  });

  console.log(`✅ GitHub provider '${provider.label}' created and enabled for user group`);
  return provider.id;
}

async function main(): Promise<void> {
  const config = parseArguments();

  if (!config.userEmail) {
    console.error('Error: userEmail is required');
    console.error('See script documentation at the top of this file for usage information.');
    process.exit(1);
  }

  // Check if at least one provider is configured
  const hasBedrock = !!(config.bedrockAccessKeyId && config.bedrockSecretAccessKey);
  const hasDocUpload = !!(config.docUploadAccessKeyId && config.docUploadSecretAccessKey && config.docUploadS3Uri);
  const hasAgentProvider = !!config.agentProviderEndpoint;
  const hasGitHub = !!config.githubAccessToken;

  if (!hasBedrock && !hasDocUpload && !hasAgentProvider && !hasGitHub) {
    console.error('Error: At least one provider must be configured');
    console.error('   Provide: bedrockAccessKeyId+bedrockSecretAccessKey, docUpload credentials, agentProviderEndpoint, or githubAccessToken');
    console.error('See script documentation at the top of this file for usage information.');
    process.exit(1);
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: config.userEmail },
  });

  if (!user) {
    console.error(`Error: User with email '${config.userEmail}' not found`);
    process.exit(1);
  }

  const auditor = createAuditor({});

  try {
    // 1. Promote user to Admin role
    if (user.role !== 'Admin') {
      await promoteUserToAdmin(config.userEmail, auditor);
    } else {
      console.log('User is already Admin');
    }

    // 2. Create second user group and add the user as a member (no preset AI provider access)
    await createOrGetSecondaryUserGroup(config, user.id, auditor);

    // 3. Setup providers first
    const providerIds: string[] = [];
    let docUploadProviderId: string | null = null;
    let defaultModelId: string | null = null;
    
    if (hasBedrock) {
      const bedrockResult = await setupBedrockProvider(config);
      if (bedrockResult) {
        providerIds.push(bedrockResult.providerId);
        defaultModelId = bedrockResult.modelId;
      }
    }

    if (hasDocUpload) {
      docUploadProviderId = await setupDocumentUploadProvider(config);
    }

    // 4. Create user group and associate AI providers
    if (providerIds.length > 0 || docUploadProviderId || hasAgentProvider || hasGitHub) {
      const userGroupIds = await createOrGetUserGroup(config, user.id, auditor);

      // Associate AI providers with user group
      for (const providerId of providerIds) {
        await prisma.aiProvider.update({
          where: { id: providerId },
          data: {
            userGroups: {
              connect: userGroupIds.map(id => ({ id })),
            },
          },
        });
      }

      if (providerIds.length > 0) {
        console.log('AI Providers associated with user group');
      }

      // Set SystemConfig settings:
      // Set document upload provider and default model as system default
      if (docUploadProviderId || defaultModelId) {
        // Get or create system config
        let systemConfig = await prisma.systemConfig.findFirst();

        const updateData: any = {};
        if (docUploadProviderId) {
          updateData.documentLibraryDocumentUploadProviderId = docUploadProviderId;
        }
        if (defaultModelId) {
          updateData.systemAiProviderModelId = defaultModelId;
          updateData.knowledgeGraphAiProviderModelId = defaultModelId;
        }
        updateData.documentLibraryDataSharingEnabled = true;
        updateData.memoryEnabled = true;

        if (systemConfig) {
          await prisma.systemConfig.update({
            where: { id: systemConfig.id },
            data: updateData,
          });
          if (docUploadProviderId) {
            console.log('Document Upload provider set as system default');
          }
          if (defaultModelId) {
            console.log('Claude Sonnet 4.5 model set as system default and knowledge graph AI model');
          }
        } else {
          await prisma.systemConfig.create({
            data: updateData,
          });
          console.log('System config updated');
        }
      }

      // 5. Setup agent provider
      if (hasAgentProvider) {
        await setupAgentProvider(config, userGroupIds);
      }

      // 6. Setup GitHub provider
      if (hasGitHub) {
        await setupGitHubProvider(config, userGroupIds);
      }

      // 7. Create example workflow
      if (defaultModelId) {
        await createExampleWorkflow(user.id, userGroupIds, defaultModelId);
      }
    } else {
      console.log('No providers were created');
    }

    console.log('System configuration successful');
  } catch (error) {
    console.error('An error occurred when configuring system settings:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
