import { NavLink, Tooltip, Divider, UnstyledButton, Collapse } from '@mantine/core';
import {
  IconBook,
  IconSparkles,
  IconPalette,
  IconMessageCircle2,
  IconRobot,
  IconNetwork,
  IconChevronDown,
} from '@tabler/icons-react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

import SafeExit from './SafeExit';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetUserEnabledAiAgents from '@/features/shared/api/get-user-enabled-ai-agents';
import { useGetUserWorkflowsAccess } from '@/features/shared/api/get-user-workflows-access';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import { UiPreference } from '@/types/ui-preferences';

interface NavigationLinksProps {
  isCollapsed?: boolean;
}

interface NavLinkDefinition {
  label: string;
  href: string;
  icon: React.ReactNode;
}

function NavigationLinks({ isCollapsed = false }: NavigationLinksProps) {
  const router = useRouter();
  const [promptToolsExpanded, setPromptToolsExpanded] = useState(false);
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

  useEffect(() => {
    const savedState = localStorage.getItem(UiPreference.PROMPT_TOOLS_NAV_EXPANDED);
    if (savedState === 'true') {
      setPromptToolsExpanded(true);
    }
  }, []);

  const primaryLinks: NavLinkDefinition[] = [
    { label: 'Chat', href: '/chat', icon: <IconMessageCircle2 stroke={1.5} /> },
    ...((userEnabledAiAgents?.enabledAiAgents?.length ?? 0) > 0
      ? [{ label: 'AI Agents', href: '/ai-agents', icon: <IconRobot stroke={1.5} /> }]
      : []
    ),
    ...(userWorkflowsAccess?.hasAccess
      ? [{ label: 'Workflows', href: '/workflows', icon: <IconNetwork stroke={1.5} /> }]
      : []
    ),
  ];

  const promptToolLinks: NavLinkDefinition[] = [
    { label: 'Prompt Library', href: '/library', icon: <IconBook stroke={1.5} /> },
    ...(systemConfig?.featureManagementPromptGenerator
      ? [{ label: 'Prompt Generator', href: '/prompt-generator', icon: <IconSparkles stroke={1.5} /> }]
      : []
    ),
    { label: 'Prompt Playground', href: '/prompt-playground', icon: <IconPalette stroke={1.5} /> },
  ];

  const determineColor = (pathname: string) => {
    return router?.asPath?.startsWith(pathname) ? 'dark.3' : 'transparent';
  };

  const handleTogglePromptTools = () => {
    const newState = !promptToolsExpanded;
    setPromptToolsExpanded(newState);
    localStorage.setItem(UiPreference.PROMPT_TOOLS_NAV_EXPANDED, newState.toString());
    track.togglePanel(newState ? 'Expand prompt tools nav group' : 'Collapse prompt tools nav group');
  };

  const isOnPromptToolRoute = promptToolLinks.some((navLink) => router?.asPath?.startsWith(navLink.href));
  const promptToolsOpen = promptToolsExpanded || isOnPromptToolRoute;

  if (systemConfigPending || userEnabledAiAgentsPending || userWorkflowsAccessPending) {
    return null;
  }

  const renderNavLink = (navLink: NavLinkDefinition) => (
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
  );

  if (isCollapsed) {
    return (
      <>
        {primaryLinks.map(renderNavLink)}
        {promptToolsOpen && promptToolLinks.map(renderNavLink)}
      </>
    );
  }

  return (
    <>
      {primaryLinks.map(renderNavLink)}
      <Divider mb='xs' />
      <UnstyledButton
        onClick={handleTogglePromptTools}
        data-testid='prompt-tools-nav-toggle'
        sx={(theme) => ({
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: theme.radius.sm,
          color: theme.colors.gray[6],
          fontSize: theme.fontSizes.xs,
          fontWeight: 600,
          '&:hover': {
            backgroundColor: theme.colors.dark[8],
            color: theme.colors.gray[2],
          },
        })}
      >
        <span>Prompt tools</span>
        <IconChevronDown
          stroke={1.5}
          size={14}
          data-testid='prompt-tools-nav-chevron'
          style={{
            transform: promptToolsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </UnstyledButton>
      <Collapse in={promptToolsOpen}>
        <div style={{ paddingTop: '8px' }}>
          {promptToolLinks.map(renderNavLink)}
        </div>
      </Collapse>
    </>
  );
}
export default NavigationLinks;
