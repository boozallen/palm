/**
 * Example Data Seed Script
 *
 * Usage: ts-node prisma/scripts/seed-example-data.ts [options]
 *
 * Seeds a realistic set of sample data around an existing user. Intended to be
 * run against an already-configured system (see
 * prisma/scripts/configure-system-settings.ts for provider/system setup).
 *
 * Required:
 *   userEmail=<email>                  Email of the user the sample data is built around
 *
 * What this script does (all idempotent and safe to re-run):
 *   - Colleague users (login password: Password123!)
 *   - Enterprise-style user groups with feature toggles
 *   - Group memberships with the target user as Lead of some, Member of others
 *   - Pre-uploaded (embedded, not graphed) documents in the target user's
 *     library, sourced from prisma/scripts/example-data-seeds/embedded-document-data.json and
 *     prisma/scripts/example-data-seeds/shared-document-ashton-data.json
 *   - A document shared into one of the target user's groups by a colleague,
 *     sourced from prisma/scripts/example-data-seeds/shared-document-data.json
 *   - An RFP/RFI-focused prompt library (owned by the target user and
 *     colleagues) with bookmarks, padding chats, and two chats with real
 *     message histories, sourced from prisma/scripts/example-data-seeds/prompt-library-data.ts
 *
 * Uploaded/shared documents require a document upload provider to already exist;
 * if none is configured, those documents are skipped and the rest is seeded.
 *
 * Example:
 *   ts-node prisma/scripts/seed-example-data.ts userEmail=admin@example.com
 */

import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createAuditor, type Auditor } from '../../server/auditor';
import { UserGroupRole } from '../../features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '../../features/shared/types/audit-record';
import embeddedDocumentData from './example-data-seeds/embedded-document-data.json';
import sharedDocumentData from './example-data-seeds/shared-document-data.json';
import sharedDocumentAshtonData from './example-data-seeds/shared-document-ashton-data.json';
import {
  PROMPT_LIBRARY,
  PROMPT_LIBRARY_CHATS,
  PROMPT_LIBRARY_MODEL,
} from './example-data-seeds/prompt-library-data';

const prisma = new PrismaClient();

// -----------------------------------------------------------------------------
// Seed data
//
// The constants below drive the seeded sample data: colleague
// users, enterprise-style user groups, group memberships (with the target user
// as Lead of some and Member of others), a single pre-seeded uploaded document
// in the target user's library, and a couple of documents shared into the
// target user's groups by colleagues.
//
// All seed data is idempotent and safe to re-run.
// -----------------------------------------------------------------------------

// Shared password for all seeded colleagues (local seed data only).
const COLLEAGUE_PASSWORD = 'Password123!';

interface EmbeddedDocumentSeed {
  filename: string;
  uploadStatus: string;
  dataProfile: Prisma.InputJsonValue;
  text: string;
  embeddings: Array<{
    content: string;
    contentNum: number;
    startPosition: number | null;
    endPosition: number | null;
    vector: string;
  }>;
}

interface GroupSeed {
  label: string;
  targetRole: UserGroupRole;
  // Feature toggles for the group (default: all enabled).
  graphDatabaseEnabled?: boolean;
  workflowsEnabled?: boolean;
  contextStudioEnabled?: boolean;
  agenticChatEnabled?: boolean;
}

interface ColleagueSeed {
  name: string;
  email: string;
  // Group label -> role within that group.
  memberships: Array<{ groupLabel: string; role: UserGroupRole }>;
}

interface ShareSeed {
  // The document (seed data) the colleague shares.
  document: EmbeddedDocumentSeed;
  // Email of the colleague who owns and shares the document.
  colleagueEmail: string;
  // Label of a group the target user belongs to, to share the document into.
  shareWithGroupLabel: string;
}

// Documents seeded directly into the target user's own library (owned, not
// shared). These appear as regular uploaded documents.
const TARGET_LIBRARY_DOCUMENTS: EmbeddedDocumentSeed[] = [
  embeddedDocumentData as EmbeddedDocumentSeed,
  sharedDocumentAshtonData as EmbeddedDocumentSeed,
];

// Document that colleagues share into the target user's groups. A copy is
// seeded into the sharing colleague's own library, then shared to a group the
// target user belongs to — producing a realistic incoming share.
const SHARED_DOCUMENT = sharedDocumentData as EmbeddedDocumentSeed;

// Enterprise-style user groups. The target user is Lead of the first few and a
// regular member of the rest, mirroring how a tenured user accumulates
// leadership in some groups while participating in many others.
const SEED_GROUPS: GroupSeed[] = [
  { label: 'Finance & PMO', targetRole: UserGroupRole.Lead },
  { label: 'BES Red Team', targetRole: UserGroupRole.Lead },
  { label: 'Proposal Development', targetRole: UserGroupRole.Lead },
  { label: 'AI/ML Engineering', targetRole: UserGroupRole.User },
  { label: 'VA Digital Services', targetRole: UserGroupRole.User },
  { label: 'Data & Analytics', targetRole: UserGroupRole.User },
  { label: 'Cloud & Platform Engineering', targetRole: UserGroupRole.User },
  { label: 'Cybersecurity & Compliance', targetRole: UserGroupRole.User },
  { label: 'Contracts & Acquisition', targetRole: UserGroupRole.User },
  {
    // A lightweight community group without the heavier features enabled,
    // to show a realistic mix of group configurations.
    label: 'Knowledge Sharing Guild',
    targetRole: UserGroupRole.Lead,
    graphDatabaseEnabled: false,
    workflowsEnabled: false,
    contextStudioEnabled: true,
    agenticChatEnabled: true,
  },
];

const SEED_COLLEAGUES: ColleagueSeed[] = [
  {
    name: 'Whitfield, Ryan [USA]',
    email: 'whitfield_ryan@example.com',
    memberships: [
      { groupLabel: 'Finance & PMO', role: UserGroupRole.User },
      { groupLabel: 'Data & Analytics', role: UserGroupRole.User },
      { groupLabel: 'Contracts & Acquisition', role: UserGroupRole.Lead },
    ],
  },
  {
    name: 'Nguyen, Linh [USA]',
    email: 'nguyen_linh@example.com',
    memberships: [
      { groupLabel: 'AI/ML Engineering', role: UserGroupRole.Lead },
      { groupLabel: 'VA Digital Services', role: UserGroupRole.User },
      { groupLabel: 'Knowledge Sharing Guild', role: UserGroupRole.User },
    ],
  },
  {
    name: 'Okafor, Daniel [USA]',
    email: 'okafor_daniel@example.com',
    memberships: [
      { groupLabel: 'BES Red Team', role: UserGroupRole.User },
      { groupLabel: 'Proposal Development', role: UserGroupRole.User },
      { groupLabel: 'Cybersecurity & Compliance', role: UserGroupRole.Lead },
    ],
  },
  {
    name: 'Patel, Priya [USA]',
    email: 'patel_priya@example.com',
    memberships: [
      { groupLabel: 'VA Digital Services', role: UserGroupRole.Lead },
      { groupLabel: 'AI/ML Engineering', role: UserGroupRole.User },
      { groupLabel: 'Cloud & Platform Engineering', role: UserGroupRole.User },
    ],
  },
  {
    name: 'Sorensen, Erik [USA]',
    email: 'sorensen_erik@example.com',
    memberships: [
      { groupLabel: 'Proposal Development', role: UserGroupRole.User },
      { groupLabel: 'Finance & PMO', role: UserGroupRole.User },
      { groupLabel: 'Contracts & Acquisition', role: UserGroupRole.User },
    ],
  },
  {
    name: 'Washington, Maya [USA]',
    email: 'washington_maya@example.com',
    memberships: [
      { groupLabel: 'Data & Analytics', role: UserGroupRole.Lead },
      { groupLabel: 'BES Red Team', role: UserGroupRole.User },
      { groupLabel: 'Cybersecurity & Compliance', role: UserGroupRole.User },
    ],
  },
  {
    name: 'Kowalski, Tomasz [USA]',
    email: 'kowalski_tomasz@example.com',
    memberships: [
      { groupLabel: 'AI/ML Engineering', role: UserGroupRole.User },
      { groupLabel: 'Cloud & Platform Engineering', role: UserGroupRole.Lead },
    ],
  },
  {
    name: 'Reyes, Sofia [USA]',
    email: 'reyes_sofia@example.com',
    memberships: [
      { groupLabel: 'Proposal Development', role: UserGroupRole.User },
      { groupLabel: 'Knowledge Sharing Guild', role: UserGroupRole.User },
      { groupLabel: 'VA Digital Services', role: UserGroupRole.User },
    ],
  },
  {
    name: 'Brennan, Liam [USA]',
    email: 'brennan_liam@example.com',
    memberships: [
      { groupLabel: 'Cloud & Platform Engineering', role: UserGroupRole.User },
      { groupLabel: 'Cybersecurity & Compliance', role: UserGroupRole.User },
    ],
  },
  {
    name: 'Chen, Grace [USA]',
    email: 'chen_grace@example.com',
    memberships: [
      { groupLabel: 'AI/ML Engineering', role: UserGroupRole.User },
      { groupLabel: 'Data & Analytics', role: UserGroupRole.User },
      { groupLabel: 'Knowledge Sharing Guild', role: UserGroupRole.User },
    ],
  },
  {
    name: 'Delacroix, Marc [USA]',
    email: 'delacroix_marc@example.com',
    memberships: [
      { groupLabel: 'Finance & PMO', role: UserGroupRole.User },
      { groupLabel: 'Contracts & Acquisition', role: UserGroupRole.User },
    ],
  },
  {
    name: 'Ahmadi, Yusuf [USA]',
    email: 'ahmadi_yusuf@example.com',
    memberships: [
      { groupLabel: 'BES Red Team', role: UserGroupRole.User },
      { groupLabel: 'VA Digital Services', role: UserGroupRole.User },
      { groupLabel: 'Proposal Development', role: UserGroupRole.User },
    ],
  },
  {
    name: 'Fitzgerald, Erin [USA]',
    email: 'fitzgerald_erin@example.com',
    memberships: [
      { groupLabel: 'Cybersecurity & Compliance', role: UserGroupRole.User },
      { groupLabel: 'Cloud & Platform Engineering', role: UserGroupRole.User },
      { groupLabel: 'Data & Analytics', role: UserGroupRole.User },
    ],
  },
];

// Colleagues who share a document into a group the target user belongs to. Each
// colleague must be a member of the target group (see memberships above) so the
// share is realistic.
const SEED_SHARES: ShareSeed[] = [
  {
    document: SHARED_DOCUMENT,
    colleagueEmail: 'nguyen_linh@example.com',
    shareWithGroupLabel: 'AI/ML Engineering',
  },
];

interface SeedConfig {
  // The user the sample data is built around.
  userEmail: string;
}

function parseArguments(): SeedConfig {
  const config: SeedConfig = {
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
      default:
        console.warn(`Unknown argument: ${key}`);
    }
  }

  console.log('Configuration values:', {
    userEmail: config.userEmail,
  });

  return config;
}

async function insertEmbeddings(
  documentId: string,
  embeddings: EmbeddedDocumentSeed['embeddings']
): Promise<void> {
  if (embeddings.length === 0) {
    return;
  }

  const values = embeddings.map((emb) => {
    const id = crypto.randomUUID();
    return Prisma.sql`(${Prisma.sql`${id}::uuid`}, ${Prisma.sql`${emb.vector}::vector`}, ${emb.content}, ${emb.contentNum}, ${emb.startPosition}, ${emb.endPosition}, ${Prisma.sql`${documentId}::uuid`})`;
  });

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "Embedding" ("id", "embedding", "content", "contentNum", "startPosition", "endPosition", "documentId")
    VALUES ${Prisma.join(values, ', ')}
  `);
}

/**
 * Seeds a fully-uploaded (embedded, not graphed) document into a user's library.
 * Creates the Document row plus its Embedding rows from the pre-captured seed
 * data. Idempotent by (filename, userId): skips if the document already exists.
 */
async function seedUploadedDocument(
  seed: EmbeddedDocumentSeed,
  userId: string,
  documentUploadProviderId: string
): Promise<string | null> {
  const existing = await prisma.document.findFirst({
    where: { filename: seed.filename, userId },
    select: { id: true },
  });

  if (existing) {
    console.log(`  • document '${seed.filename}' already exists, skipping`);
    return existing.id;
  }

  const document = await prisma.document.create({
    data: {
      filename: seed.filename,
      userId,
      documentUploadProviderId,
      uploadStatus: seed.uploadStatus,
      text: seed.text,
      dataProfile: seed.dataProfile,
    },
  });

  await insertEmbeddings(document.id, seed.embeddings);

  console.log(`  • seeded document '${seed.filename}' (${seed.embeddings.length} embeddings)`);
  return document.id;
}

async function seedData(
  targetUserId: string,
  targetUserName: string,
  documentUploadProviderId: string | null,
  auditor: Auditor
): Promise<void> {
  const hashedPassword = await bcrypt.hash(COLLEAGUE_PASSWORD, 10);

  console.log('Seeding colleague users...');
  const colleagueIdsByEmail = new Map<string, string>();
  for (const colleague of SEED_COLLEAGUES) {
    const user = await prisma.user.upsert({
      where: { email: colleague.email },
      update: { name: colleague.name },
      create: {
        name: colleague.name,
        email: colleague.email,
        hashedPassword,
        role: 'User',
      },
    });
    colleagueIdsByEmail.set(colleague.email, user.id);
    console.log(`  • ${colleague.name} (${colleague.email})`);
  }

  console.log('Seeding user groups...');
  const groupIdsByLabel = new Map<string, string>();
  for (const group of SEED_GROUPS) {
    const features = {
      graphDatabaseEnabled: group.graphDatabaseEnabled ?? true,
      workflowsEnabled: group.workflowsEnabled ?? true,
      contextStudioEnabled: group.contextStudioEnabled ?? true,
      agenticChatEnabled: group.agenticChatEnabled ?? true,
    };
    // label has no DB-level uniqueness (see schema.prisma), so this advisory lock
    // guards the same find-then-write race that createUserGroup's app-layer lock
    // protects against for the normal creation path.
    const userGroup = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(lower(${group.label})))`;
      const existingUserGroup = await tx.userGroup.findFirst({
        where: { label: group.label, deletedAt: null },
      });
      return existingUserGroup
        ? tx.userGroup.update({
          where: { id: existingUserGroup.id },
          data: features,
        })
        : tx.userGroup.create({
          data: {
            label: group.label,
            ...features,
          },
        });
    });
    groupIdsByLabel.set(group.label, userGroup.id);
    console.log(`  • ${group.label}`);
  }

  console.log('Adding target user to groups...');
  for (const group of SEED_GROUPS) {
    const groupId = groupIdsByLabel.get(group.label);
    if (!groupId) {
      continue;
    }
    await prisma.userGroupMembership.upsert({
      where: { userGroupId_userId: { userGroupId: groupId, userId: targetUserId } },
      update: { role: group.targetRole },
      create: { userGroupId: groupId, userId: targetUserId, role: group.targetRole },
    });
    console.log(`  • ${targetUserName} is ${group.targetRole} of '${group.label}'`);
  }

  console.log('Adding colleagues to groups...');
  for (const colleague of SEED_COLLEAGUES) {
    const colleagueId = colleagueIdsByEmail.get(colleague.email);
    if (!colleagueId) {
      continue;
    }
    for (const membership of colleague.memberships) {
      const groupId = groupIdsByLabel.get(membership.groupLabel);
      if (!groupId) {
        continue;
      }
      await prisma.userGroupMembership.upsert({
        where: { userGroupId_userId: { userGroupId: groupId, userId: colleagueId } },
        update: { role: membership.role },
        create: { userGroupId: groupId, userId: colleagueId, role: membership.role },
      });
    }
  }

  let sharesCreated = 0;
  if (documentUploadProviderId) {
    console.log('Seeding uploaded documents in target user library...');
    for (const libraryDocument of TARGET_LIBRARY_DOCUMENTS) {
      await seedUploadedDocument(libraryDocument, targetUserId, documentUploadProviderId);
    }

    console.log('Seeding documents shared into target user groups...');
    for (const share of SEED_SHARES) {
      const colleagueId = colleagueIdsByEmail.get(share.colleagueEmail);
      const groupId = groupIdsByLabel.get(share.shareWithGroupLabel);
      if (!colleagueId || !groupId) {
        console.log(`  ⚠️  Skipping share into '${share.shareWithGroupLabel}' (missing colleague or group)`);
        continue;
      }

      // Seed a colleague-owned copy of the shared document, then share it into
      // the target user's group so it surfaces as an incoming share.
      const documentId = await seedUploadedDocument(share.document, colleagueId, documentUploadProviderId);
      if (!documentId) {
        continue;
      }

      const existingShare = await prisma.sharedDocument.findFirst({
        where: { sourceDocumentId: documentId, sourceUserId: colleagueId, deletedAt: null },
      });

      if (existingShare) {
        console.log(`  • share into '${share.shareWithGroupLabel}' already exists`);
        continue;
      }

      await prisma.sharedDocument.create({
        data: {
          sourceDocumentId: documentId,
          sourceUserId: colleagueId,
          sharedWithUserGroupIds: [groupId],
        },
      });

      auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `Document '${share.document.filename}' shared with group '${share.shareWithGroupLabel}'`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });

      sharesCreated += 1;
      console.log(`  • '${share.document.filename}' shared into '${share.shareWithGroupLabel}' by ${share.colleagueEmail}`);
    }
  } else {
    console.log('⚠️  Skipping uploaded/shared documents (no document upload provider available)');
  }

  console.log('Seeding prompt library with chats...');
  const promptCounts = await seedPromptLibrary(targetUserId, colleagueIdsByEmail);

  console.log('✅ Seed data complete');
  console.log(`   Colleagues: ${SEED_COLLEAGUES.length} | Groups: ${SEED_GROUPS.length} | Shares: ${sharesCreated}`);
  console.log(`   Prompts: ${promptCounts.prompts} | Chats: ${promptCounts.chats} | Bookmarks: ${promptCounts.bookmarks}`);
  console.log(`   Colleague login password: ${COLLEAGUE_PASSWORD}`);
}

/**
 * Seeds the prompt library: prompts owned by the target user and colleagues,
 * padding chats that drive the MOST CHATTED badge, bookmarks that drive the
 * MOST BOOKMARKED badge, and two chats with real message histories (one owned
 * by the target user, one by a colleague). Idempotent by prompt slug and by
 * chat summary.
 */
async function seedPromptLibrary(
  targetUserId: string,
  colleagueIdsByEmail: Map<string, string>
): Promise<{ prompts: number; chats: number; bookmarks: number }> {
  const colleagueIds = Array.from(colleagueIdsByEmail.values());
  // All users who can bookmark / own padding chats: target user + colleagues.
  const allUserIds = [targetUserId, ...colleagueIds];

  const resolveOwnerId = (owner: string): string | null => {
    if (owner === 'target') {
      return targetUserId;
    }
    return colleagueIdsByEmail.get(owner) ?? null;
  };

  const promptIdBySlug = new Map<string, string>();
  let promptCount = 0;
  let chatCount = 0;
  let bookmarkCount = 0;

  for (const promptSeed of PROMPT_LIBRARY) {
    const creatorId = resolveOwnerId(promptSeed.owner);

    const prompt = await prisma.prompt.upsert({
      where: { slug: promptSeed.slug },
      update: {
        title: promptSeed.title,
        summary: promptSeed.summary,
        description: promptSeed.description,
        instructions: promptSeed.instructions,
        example: promptSeed.example,
        creatorId,
      },
      create: {
        slug: promptSeed.slug,
        title: promptSeed.title,
        summary: promptSeed.summary,
        description: promptSeed.description,
        instructions: promptSeed.instructions,
        example: promptSeed.example,
        model: PROMPT_LIBRARY_MODEL,
        temperature: promptSeed.temperature,
        topP: promptSeed.topP,
        creatorId,
        tags: {
          create: promptSeed.tags.map((tag) => ({ tag })),
        },
      },
    });
    promptIdBySlug.set(promptSeed.slug, prompt.id);
    promptCount += 1;
    console.log(`  • prompt '${promptSeed.title}' (owner: ${promptSeed.owner})`);

    // Bookmarks: assign to distinct users (target first, then colleagues) so the
    // MOST BOOKMARKED count is exactly bookmarkCount.
    const bookmarkUserIds = allUserIds.slice(0, Math.min(promptSeed.bookmarkCount, allUserIds.length));
    for (const userId of bookmarkUserIds) {
      await prisma.promptBookmark.upsert({
        where: { userId_promptId: { userId, promptId: prompt.id } },
        update: {},
        create: { userId, promptId: prompt.id },
      });
      bookmarkCount += 1;
    }

    // Padding chats drive the MOST CHATTED usage count. These carry no messages
    // and are spread across colleagues so they never appear in the target
    // user's own chat history. Chats with real histories (below) are created
    // separately and also count toward usage — subtract them here to hit the
    // target total. Idempotent via a deterministic summary marker.
    const historyChatsForPrompt = PROMPT_LIBRARY_CHATS.filter((c) => c.promptSlug === promptSeed.slug).length;
    const paddingChats = Math.max(promptSeed.chatCount - historyChatsForPrompt, 0);
    for (let i = 0; i < paddingChats; i++) {
      // Spread padding chats across colleagues (fall back to target if none).
      const ownerId = colleagueIds.length > 0
        ? colleagueIds[i % colleagueIds.length]
        : targetUserId;
      const summaryMarker = `[seed] ${promptSeed.slug} #${i + 1}`;
      const existing = await prisma.chat.findFirst({
        where: { userId: ownerId, promptId: prompt.id, summary: summaryMarker },
        select: { id: true },
      });
      if (!existing) {
        await prisma.chat.create({
          data: {
            userId: ownerId,
            promptId: prompt.id,
            summary: summaryMarker,
          },
        });
      }
      chatCount += 1;
    }
  }

  // Chats with real message histories.
  for (const chatSeed of PROMPT_LIBRARY_CHATS) {
    const promptId = promptIdBySlug.get(chatSeed.promptSlug);
    const ownerId = resolveOwnerId(chatSeed.owner);
    if (!promptId || !ownerId) {
      console.log(`  ⚠️  Skipping chat '${chatSeed.summary}' (missing prompt or owner)`);
      continue;
    }

    const existing = await prisma.chat.findFirst({
      where: { userId: ownerId, promptId, summary: chatSeed.summary },
      select: { id: true },
    });
    if (existing) {
      console.log(`  • chat '${chatSeed.summary}' already exists`);
      continue;
    }

    await prisma.chat.create({
      data: {
        userId: ownerId,
        promptId,
        summary: chatSeed.summary,
        messages: {
          create: chatSeed.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        },
      },
    });
    chatCount += 1;
    console.log(`  • chat '${chatSeed.summary}' (owner: ${chatSeed.owner}, ${chatSeed.messages.length} messages)`);
  }

  return { prompts: promptCount, chats: chatCount, bookmarks: bookmarkCount };
}

async function main(): Promise<void> {
  const config = parseArguments();

  if (!config.userEmail) {
    console.error('Error: userEmail is required');
    console.error('See script documentation at the top of this file for usage information.');
    process.exit(1);
  }

  // Find the user the sample data is built around.
  const user = await prisma.user.findUnique({
    where: { email: config.userEmail },
  });

  if (!user) {
    console.error(`Error: User with email '${config.userEmail}' not found`);
    process.exit(1);
  }

  const auditor = createAuditor({});

  try {
    // Uploaded/shared documents need a document upload provider; resolve an
    // existing one if configured, otherwise those documents are skipped.
    const uploadProviderId =
      (await prisma.documentUploadProvider.findFirst({ select: { id: true } }))?.id ?? null;

    console.log('\nSeeding data...');
    await seedData(user.id, user.name, uploadProviderId, auditor);

    console.log('Example data seeding successful');
  } catch (error) {
    console.error('An error occurred when seeding example data:', error);
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
