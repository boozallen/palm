import { NavLink } from '@mantine/core';
import {
  IconBook,
  IconSparkles,
  IconPalette,
  IconMessageCircle2,
  IconRobot,
} from '@tabler/icons-react';
import React from 'react';
import { useRouter } from 'next/router';
import SafeExit from './SafeExit';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import Loading from '@/features/shared/components/Loading';
import useGetUserEnabledAiAgents from '@/features/shared/api/get-user-enabled-ai-agents';

function NavigationLinks() {
  const router = useRouter();
  const {
    data: userEnabledAiAgents,
    isPending: userEnabledAiAgentsPending,
  } = useGetUserEnabledAiAgents();

  const {
    data: systemConfig,
    isPending: systemConfigPending,
  } = useGetSystemConfig();
  const showPromptGenerator = systemConfig?.featureManagementPromptGenerator;
  const navLinks = [
    { label: 'Chat', href: '/chat', icon: <IconMessageCircle2 stroke={1} /> },
    { label: 'Prompt Library', href: '/library', icon: <IconBook stroke={1} /> },
    ...(showPromptGenerator
      ? [{ label: 'Prompt Generator', href: '/prompt-generator', icon: <IconSparkles stroke={1} /> }]
      : []
    ),
    { label: 'Prompt Playground', href: '/prompt-playground', icon: <IconPalette stroke={1} /> },
  ];
  if ((userEnabledAiAgents?.enabledAiAgents?.length ?? 0) > 0) {
    navLinks.push(
      { label: 'AI Agents', href: '/ai-agents', icon: <IconRobot stroke={1} /> }
    );
  }
  const determineColor = (pathname: string) => {
    return router?.asPath?.startsWith(pathname) ? 'dark.4' : 'dark.6';
  };
  if (systemConfigPending || userEnabledAiAgentsPending) {
    return <Loading />;
  }
  return (
    <>
      {navLinks.map((navLink) => (
        <NavLink
          key={navLink.label}
          label={navLink.label}
          component={SafeExit}
          href={navLink.href}
          icon={navLink.icon}
          bg={determineColor(navLink.href)}
          mb='md'
          active={router?.asPath?.startsWith(navLink.href)}
        />
      ))}
    </>
  );
}
export default NavigationLinks;
