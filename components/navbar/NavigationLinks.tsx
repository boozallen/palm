import { NavLink, Tooltip } from '@mantine/core';
import {
  IconBook,
  IconSparkles,
  IconPalette,
  IconMessageCircle2,
  IconRobot,
  IconNetwork,
} from '@tabler/icons-react';
import React from 'react';
import { useRouter } from 'next/router';

import SafeExit from './SafeExit';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetUserEnabledAiAgents from '@/features/shared/api/get-user-enabled-ai-agents';
import { useGetUserWorkflowsAccess } from '@/features/shared/api/get-user-workflows-access';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

interface NavigationLinksProps {
  isCollapsed?: boolean;
}

function NavigationLinks({ isCollapsed = false }: NavigationLinksProps) {
  const router = useRouter();
  const {
    data: userEnabledAiAgents,
    isPending: userEnabledAiAgentsPending,
  } = useGetUserEnabledAiAgents();

  const {
    data: systemConfig,
    isPending: systemConfigPending,
  } = useGetSystemConfig();

  const {
    data: userWorkflowsAccess,
    isPending: userWorkflowsAccessPending,
  } = useGetUserWorkflowsAccess();

  const track = useTrackClientEvent();

  const navLinks = [
    { label: 'Chat', href: '/chat', icon: <IconMessageCircle2 stroke={1.5} /> },
    { label: 'Prompt Library', href: '/library', icon: <IconBook stroke={1.5} /> },
    ...(userWorkflowsAccess?.hasAccess
      ? [{ label: 'Workflows', href: '/workflows', icon: <IconNetwork stroke={1.5} /> }]
      : []
    ),
    ...((userEnabledAiAgents?.enabledAiAgents?.length ?? 0) > 0
      ? [{ label: 'AI Agents', href: '/ai-agents', icon: <IconRobot stroke={1.5} /> }]
      : []
    ),
    ...(systemConfig?.featureManagementPromptGenerator
      ? [{ label: 'Prompt Generator', href: '/prompt-generator', icon: <IconSparkles stroke={1.5} /> }]
      : []
    ),
    { label: 'Prompt Playground', href: '/prompt-playground', icon: <IconPalette stroke={1.5} /> },
  ];
  const determineColor = (pathname: string) => {
    return router?.asPath?.startsWith(pathname) ? 'dark.3' : 'transparent';
  };
  if (systemConfigPending || userEnabledAiAgentsPending || userWorkflowsAccessPending) {
    return null;
  }
  return (
    <>
      {navLinks.map((navLink) => (
        isCollapsed ? (
          <Tooltip key={navLink.label} label={navLink.label} position='right' openDelay={0} zIndex={1000} withinPortal>
            <div>
              <NavLink
                label={''}
                component={SafeExit}
                href={navLink.href}
                onClick={() => track.navigate(navLink.label, navLink.href)}
                icon={navLink.icon}
                bg={determineColor(navLink.href)}
                mb='md'
                active={router?.asPath?.startsWith(navLink.href)}
                className={navLink.href === '/chat' ? 'chat-nav-link' : ''}
                styles={(theme) => ({
                  root: {
                    justifyContent: 'center',
                    padding: '8px',
                    '&:hover': {
                      backgroundColor: theme.colors.dark[8],
                    },
                  },
                  icon: {
                    marginRight: 0,
                  },
                  body: {
                    display: 'none',
                  },
                  label: {
                    display: 'none',
                  },
                })}
              />
            </div>
          </Tooltip>
        ) : (
          <NavLink
            key={navLink.label}
            label={navLink.label}
            component={SafeExit}
            href={navLink.href}
            onClick={() => track.navigate(navLink.label, navLink.href)}
            icon={navLink.icon}
            bg={determineColor(navLink.href)}
            mb='md'
            active={router?.asPath?.startsWith(navLink.href)}
            title={navLink.label}
            className={navLink.href === '/chat' ? 'chat-nav-link' : ''}
            styles={(theme) => ({
              root: {
                '&:hover': {
                  backgroundColor: theme.colors.dark[8],
                },
              },
            })}
          />
        )
      ))}
    </>
  );
}
export default NavigationLinks;
