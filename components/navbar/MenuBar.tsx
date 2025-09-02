import { Navbar, Divider, createStyles } from '@mantine/core';
import HeadingLogo from './HeadingLogo';
import UserProfileLink from './UserProfileLink';
import React from 'react';
import NavigationLinks from './NavigationLinks';
import ChatWidget from './ChatWidget';
import ChatHistory from './ChatHistory';
import SettingsNavLink from './SettingsNavLink';
import AnalyticsNavLink from './AnalyticsNavLink';
import PolicyLink from './PolicyLink';
import { useSession } from 'next-auth/react';
import { UserRole } from '@/features/shared/types/user';
import useGetIsUserGroupLead from '@/features/shared/api/get-is-user-group-lead';

const useStyles = createStyles((theme) => ({
  leftNav: {
    backgroundColor: theme.colors.dark[6],
    overflowY: 'auto',
  },
}));

export default function MenuBar() {
  // State to be removed/replaced once chat components are routed with DB.
  const { classes } = useStyles();

  const session = useSession();
  const userRole = session.data?.user.role;
  const { data: isUserGroupLead } = useGetIsUserGroupLead();

  return (
    <Navbar width={{ base: 264, lg: 288 }} className={classes.leftNav}>
      <Navbar.Section m='lg'>
        <HeadingLogo />
      </Navbar.Section>
      <Divider />
      <Navbar.Section m='lg'>
        <NavigationLinks />
      </Navbar.Section>
      <Divider />
      <Navbar.Section m={'lg'} mb={0}>
        <ChatWidget />
      </Navbar.Section>
      <Navbar.Section grow mt={0} pb='lg' style={{ overflowY: 'auto' }}>
        <ChatHistory />
      </Navbar.Section>
      {(userRole === UserRole.Admin || isUserGroupLead?.isUserGroupLead) &&
        <>
          <Divider />
          <Navbar.Section m='md'>
            <SettingsNavLink />
          </Navbar.Section >
        </>
      }
      {userRole === UserRole.Admin &&
        <>
          <Divider />
          <Navbar.Section m='md'>
            <AnalyticsNavLink />
          </Navbar.Section >
        </>
      }
      <Divider />
      <Navbar.Section m='md'>
        <UserProfileLink />
      </Navbar.Section >
      <Divider />

      <Navbar.Section m='sm'>
        <PolicyLink />
      </Navbar.Section>
    </Navbar >
  );
}
