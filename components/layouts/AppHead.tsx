import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function AppHead() {
  const router = useRouter();
  const path = router.pathname.replace('/', '').toLowerCase();

  const promptSlug = router.query?.promptSlug ? String(router.query.promptSlug) : '';
  const agentSlug = router.query?.agentSlug ? String(router.query.agentSlug) : '';

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
      title = `Chat - ${convertSlugToTitle(promptSlug)}`;
      meta_description = 'Continue your conversation with PALM, utilizing LLMs for insightful dialogue and feedback.';
      break;
    case 'library':
      title = 'Prompt Library';
      meta_description = 'Explore the library of reusable engineered prompts for various use cases.';
      break;
    case 'library/[slug]/[promptid]':
      title = `Prompt - ${convertSlugToTitle(promptSlug)}`;
      meta_description = `Detailed view of the prompt: ${convertSlugToTitle(promptSlug)}. Discover its applications and usage.`;
      break;
    case 'library/[slug]/[promptid]/edit':
      title = `Edit Prompt - ${convertSlugToTitle(promptSlug)}`;
      meta_description = `Edit the prompt: ${convertSlugToTitle(promptSlug)} to tailor it to your specific needs.`;
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
    case 'ai-agents/[agentslug]':
      title = `AI Agent - ${convertSlugToTitle(agentSlug)}`;
      meta_description = `Detailed view of AI Agent: ${convertSlugToTitle(agentSlug)}. Explore its functionalities and applications.`;
      break;
    case 'settings':
      title = 'Settings';
      meta_description = 'Configure PALM settings to optimize your experience and security.';
      break;
    case 'settings/user-groups/[id]':
      title = 'User Group';
      meta_description = 'Manage user groups within PALM, ensuring precise access control and collaboration.';
      break;
    case 'analytics':
      title = 'Analytics';
      meta_description = 'Analyze PALM usage with comprehensive analytics tools and reporting.';
      break;
    case 'profile':
      title = 'Profile';
      meta_description = 'View and edit your PALM profile to personalize your user experience.';
      break;
    case 'legal':
      title = 'Legal Policies';
      meta_description = 'Review the legal policies governing the use of PALM, ensuring compliance and security.';
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
