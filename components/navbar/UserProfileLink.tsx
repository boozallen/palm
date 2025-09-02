import { NavLink } from '@mantine/core';
import React, { useContext } from 'react';
import { UserSessionContext } from '@/components/layouts/AuthWrap';
import SafeExit from '@/components/navbar/SafeExit';
import { IconUserCircle } from '@tabler/icons-react';
import { useRouter } from 'next/router';

function UserProfileLink() {
  const session = useContext(UserSessionContext);
  const { name, email } = session.user;

  const router = useRouter();
  const active = router.asPath.startsWith('/profile');

  return (
    <NavLink
      label={name}
      description={email}
      component={SafeExit}
      href='/profile'
      icon={<IconUserCircle stroke={1.5} />}
      bg={active ? 'dark.4' : 'inherit'}
      active={active}
    />
  );
}

export default UserProfileLink;
