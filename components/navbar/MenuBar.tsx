import { Navbar, Divider, createStyles, ActionIcon, ThemeIcon, Avatar, Tooltip, Group } from '@mantine/core';
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconSettings, IconActivity } from '@tabler/icons-react';
import React, { useState, useEffect, useContext } from 'react';
import { useSession } from 'next-auth/react';

import HeadingLogo from './HeadingLogo';
import NavigationLinks from './NavigationLinks';
import ChatHistory from './ChatHistory';
import PolicyLink from './PolicyLink';
import SafeExit from './SafeExit';
import { UserSessionContext } from '@/components/layouts/AuthWrap';
import { UserRole } from '@/features/shared/types/user';
import useGetIsUserGroupLead from '@/features/shared/api/get-is-user-group-lead';
import { useGetUserContextStudioAccess } from '@/features/shared/api/get-user-context-studio-access';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import { UiPreference } from '@/types/ui-preferences';

const useStyles = createStyles((theme) => ({
  leftNav: {
    backgroundColor: theme.colors.dark[5],
    overflowY: 'auto',
  },
  collapseButton: {
    color: theme.colors.gray[2],
    '&:hover': {
      backgroundColor: theme.colors.dark[5],
    },
  },
}));

export default function MenuBar() {
  const { classes } = useStyles();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const session = useSession();
  const userRole = session.data?.user.role;
  const { data: isUserGroupLead } = useGetIsUserGroupLead();
  const { data: userContextStudioAccess } = useGetUserContextStudioAccess();
  const userSession = useContext(UserSessionContext);
  const { name } = userSession.user;

  const track = useTrackClientEvent();

  const getFirstNameInitial = (fullName: string) => {
    if (!fullName) {
      return '';
    }
    if (fullName.includes(',')) {
      const parts = fullName.split(',').map(part => part.trim());
      return parts[1]?.charAt(0).toUpperCase() || parts[0]?.charAt(0).toUpperCase() || '';
    }
    return fullName.charAt(0).toUpperCase();
  };

  useEffect(() => {
    const savedState = localStorage.getItem(UiPreference.MENUBAR_COLLAPSED);
    if (savedState === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(UiPreference.MENUBAR_COLLAPSED, newState.toString());
    // The label names the direction the click took, not the button's new state,
    // so a reader of the trail sees what the user did.
    track.togglePanel(newState ? 'Collapse sidebar' : 'Expand sidebar');
  };

  return (
    <Navbar
      width={{ base: isCollapsed ? 64 : 240, lg: isCollapsed ? 64 : 264 }}
      className={classes.leftNav}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
    >
      {/* Logo and collapse toggle */}
      <Navbar.Section
        px={isCollapsed ? 'xs' : 'md'}
        py='lg'
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'initial',
          gap: isCollapsed ? 0 : '8px',
          flexShrink: 0,
        }}
      >
        <ActionIcon
          variant='subtle'
          size='sm'
          className={classes.collapseButton}
          onClick={handleToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ThemeIcon size='sm'>
            {isCollapsed ?
              <IconLayoutSidebarLeftExpand stroke={1.5} />
            :
              <IconLayoutSidebarLeftCollapse stroke={1.5} />
            }
          </ThemeIcon>
        </ActionIcon>
        {!isCollapsed && <HeadingLogo />}
      </Navbar.Section>

      {/* Primary navigation links */}
      <Navbar.Section px={isCollapsed ? 'sm' : 'md'} pt='xs' pb='xs' style={{ flexShrink: 0 }}>
        <NavigationLinks isCollapsed={isCollapsed} />
      </Navbar.Section>

      {/* Chat history with flex grow and scroll */}
      {!isCollapsed && <Divider />}
      <Navbar.Section
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
        pt='sm'
      >
        <ChatHistory isCollapsed={isCollapsed} />
      </Navbar.Section>

      {/* Bottom utility section */}
      <Divider />
      <Navbar.Section px={isCollapsed ? 'xs' : 'md'} pt='xs' pb='xs' style={{ flexShrink: 0 }}>
        {!isCollapsed ? (
          <>
            {/* Icon row for Settings, Context Studio, and Profile */}
            <Group spacing='sm'>
              {(userRole === UserRole.Admin || isUserGroupLead?.isUserGroupLead) && (
                <Tooltip label='Settings' position='right' openDelay={0} zIndex={1000} withinPortal>
                  <div>
                    <ActionIcon
                      component={SafeExit}
                      href='/settings'
                      onClick={() => track.navigate('Settings', '/settings')}
                      size={36}
                      variant='subtle'
                      color='gray'
                      data-testid='settings-nav-link'
                      style={{ borderRadius: '6px' }}
                    >
                      <IconSettings stroke={1.5} size={20} />
                    </ActionIcon>
                  </div>
                </Tooltip>
              )}
              {userContextStudioAccess?.hasAccess && (
                <Tooltip label='Context Studio' position='right' openDelay={0} zIndex={1000} withinPortal>
                  <div>
                    <ActionIcon
                      component={SafeExit}
                      href='/context-studio'
                      onClick={() => track.navigate('Context Studio', '/context-studio')}
                      size={36}
                      variant='subtle'
                      color='gray'
                      data-testid='context-studio-nav-link'
                      style={{ borderRadius: '6px' }}
                    >
                      <IconActivity stroke={1.5} size={20} />
                    </ActionIcon>
                  </div>
                </Tooltip>
              )}

              {/* Profile avatar */}
              <Tooltip label={name} position='right' openDelay={0} zIndex={1000} withinPortal>
                <div>
                  <ActionIcon
                    component={SafeExit}
                    href='/profile'
                    onClick={() => track.navigate('Profile', '/profile')}
                    size={36}
                    variant='subtle'
                    style={{ borderRadius: '6px', padding: 0 }}
                    data-testid='user-profile-link'
                  >
                    <Avatar size={36} radius='6px' color='cyan' data-testid='user-profile-avatar'>
                      {getFirstNameInitial(name)}
                    </Avatar>
                  </ActionIcon>
                </div>
              </Tooltip>
            </Group>
          </>
        ) : (
          <>
            {/* Collapsed view: show icons vertically with larger size */}
            {(userRole === UserRole.Admin || isUserGroupLead?.isUserGroupLead) && (
              <Tooltip label='Settings' position='right' openDelay={0} zIndex={1000} withinPortal>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <ActionIcon
                    component={SafeExit}
                    href='/settings'
                    onClick={() => track.navigate('Settings', '/settings')}
                    size={40}
                    variant='subtle'
                    color='gray'
                    data-testid='settings-nav-link'
                    style={{ borderRadius: '6px' }}
                  >
                    <IconSettings stroke={1.5} size={20} />
                  </ActionIcon>
                </div>
              </Tooltip>
            )}
            {userContextStudioAccess?.hasAccess && (
              <Tooltip label='Context Studio' position='right' openDelay={0} zIndex={1000} withinPortal>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <ActionIcon
                    component={SafeExit}
                    href='/context-studio'
                    onClick={() => track.navigate('Context Studio', '/context-studio')}
                    size={40}
                    variant='subtle'
                    color='gray'
                    data-testid='context-studio-nav-link'
                    style={{ borderRadius: '6px' }}
                  >
                    <IconActivity stroke={1.5} size={20} />
                  </ActionIcon>
                </div>
              </Tooltip>
            )}
            <Tooltip label={name} position='right' openDelay={0} zIndex={1000} withinPortal>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <ActionIcon
                  component={SafeExit}
                  href='/profile'
                  onClick={() => track.navigate('Profile', '/profile')}
                  size={40}
                  variant='subtle'
                  style={{ borderRadius: '6px', padding: 0 }}
                  data-testid='user-profile-link'
                >
                  <Avatar size={40} radius='6px' color='cyan' data-testid='user-profile-avatar'>
                    {getFirstNameInitial(name)}
                  </Avatar>
                </ActionIcon>
              </div>
            </Tooltip>
          </>
        )}
      </Navbar.Section>

      {!isCollapsed && <Divider />}
      <Navbar.Section px={isCollapsed ? 'xs' : 'sm'} py='xs' style={{ flexShrink: 0 }}>
        <PolicyLink isCollapsed={isCollapsed} />
      </Navbar.Section>
    </Navbar >
  );
}
