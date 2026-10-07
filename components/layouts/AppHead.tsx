import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useGetUserGroup from '@/features/settings/api/user-groups/get-user-group';

export default function AppHead() {
  const router = useRouter();
  const path = router.pathname.replace('/', '').toLowerCase();

  const chatPromptSlug = router.query?.promptSlug ? String(router.query.promptSlug) : '';
  const libraryPromptSlug = router.query?.slug ? String(router.query.slug) : '';
  const agentSlug = router.query?.agentSlug ? String(router.query.agentSlug) : '';
  const workflowSlug = router.query?.slug ? String(router.query.slug) : '';

  // The user group route only has an opaque DB id in its URL, so unlike the slug-based
  // routes above the label has to come from an API call rather than the URL.
  const userGroupId = path === 'settings/user-groups/[id]' && router.query?.id ? String(router.query.id) : '';
  const { data: userGroup } = useGetUserGroup(userGroupId);

  const convertSlugToTitle = (slug: string): string => {
    return slug
      .replaceAll('-', ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  let title = '';
  let meta_description = '';
  switch (path) {
    case 'chat':
      title = 'New Chat';
      meta_description = 'Start a new chat with PALM, leveraging the power of LLMs to solve a wide variety of use cases.';
      break;
    case 'chat/[chatid]':
      title = 'Chat';
      meta_description = 'Continue your conversation with PALM, utilizing LLMs for insightful dialogue and feedback.';
      break;
    case 'chat/[chatid]/[promptslug]':
      title = `Chat - ${convertSlugToTitle(chatPromptSlug)}`;
      meta_description = 'Continue your conversation with PALM, utilizing LLMs for insightful dialogue and feedback.';
      break;
    case 'library':
      title = 'Prompt Library';
      meta_description = 'Explore the library of reusable engineered prompts for various use cases.';
      break;
    case 'library/[slug]/[promptid]':
      title = `Prompt - ${convertSlugToTitle(libraryPromptSlug)}`;
      meta_description = `Detailed view of the prompt: ${convertSlugToTitle(libraryPromptSlug)}. Discover its applications and usage.`;
      break;
    case 'library/[slug]/[promptid]/edit':
      title = `Edit Prompt - ${convertSlugToTitle(libraryPromptSlug)}`;
      meta_description = `Edit the prompt: ${convertSlugToTitle(libraryPromptSlug)} to tailor it to your specific needs.`;
      break;
    case 'library/add':
      title = 'Add Prompt';
      meta_description = 'Add a new prompt to the Prompt Library.';
      break;
    case 'prompt-generator':
      title = 'Prompt Generator';
      meta_description = 'Generate customized prompts with the Prompt Generator tool.';
      break;
    case 'prompt-playground':
      title = 'Prompt Playground';
      meta_description = 'Experiment with various LLMs and their configurations in the Prompt Playground.';
      break;
    case 'ai-agents':
      title = 'AI Agents';
      meta_description = 'Explore and interact with custom AI agents designed for enterprise use cases.';
      break;
    case 'ai-agents/[agentslug]/[agentid]':
      title = `AI Agent - ${convertSlugToTitle(agentSlug)}`;
      meta_description = `Detailed view of AI Agent: ${convertSlugToTitle(agentSlug)}. Explore its functionalities and applications.`;
      break;
    case 'workflows':
      title = 'Workflows';
      meta_description = 'Create and manage custom AI workflows using primitives like web scraping, LLM prompts, and report generation.';
      break;
    case 'workflows/create':
      title = 'Create Workflow';
      meta_description = 'Build complex workflows with custom logic and tools.';
      break;
    case 'workflows/[slug]/[workflowid]':
      title = `Workflow - ${convertSlugToTitle(workflowSlug)}`;
      meta_description = 'Execute and monitor your custom AI workflow. Track progress and view results from each primitive step.';
      break;
    case 'workflows/[slug]/view/[executionid]/[primitiveid]':
      title = `Workflow - ${convertSlugToTitle(workflowSlug)} - View artifact`;
      meta_description = 'View workflow HTML artifact.';
      break;
    case 'settings':
      title = 'Settings';
      meta_description = 'Configure PALM settings to optimize your experience and security.';
      break;
    case 'settings/user-groups/[id]':
      title = userGroup?.label ? `User Group - ${userGroup.label}` : 'User Group';
      meta_description = 'Manage user groups within PALM, ensuring precise access control and collaboration.';
      break;
    case 'settings/ai-agents/[id]':
      title = 'AI Agent - Configuration';
      meta_description = 'Configure and manage AI agent settings, policies, and behavior.';
      break;
    case 'context-studio':
      title = 'Context Studio';
      meta_description = 'Monitor and track LLM interactions with real-time observability and performance insights.';
      break;
    case 'profile':
      title = 'Profile';
      meta_description = 'View and edit your PALM profile to personalize your user experience.';
      break;
    case 'legal':
      title = 'Legal Policies';
      meta_description = 'Review the legal policies governing the use of PALM, ensuring compliance and security.';
      break;
    case 'settings/databases/neo4j':
      title = 'Neo4j Knowledge Graph Database';
      meta_description = 'Explore and query your Neo4j knowledge graph database';
      break;
    case 'settings/databases/postgres':
      title = 'PostgreSQL Database';
      meta_description = 'Explore and query your PostgreSQL database';
      break;
    default:
      title = 'Prompt & Agent Library Marketplace (PALM)';
      meta_description = 'Use Prompt & Agent Library Marketplace (PALM) to empower, govern, and innovate with accessible and secure LLM solutions.';
  }

  return (
    <Head>
      <title>{title}</title>
      <meta name='description' content={meta_description} />
    </Head>
  );
}
