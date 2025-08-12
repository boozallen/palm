import SafeExit from '@/components/navbar/SafeExit';
import { NavLink } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import { useRouter } from 'next/router';

export default function SettingsNavLink() {
  const router = useRouter();
  const active = router.asPath.startsWith('/settings');
  
  return (
    <NavLink
      label='Settings'
      component={SafeExit}
      href='/settings'
      icon={<IconSettings stroke={1.5} />}
      data-testid='settings-nav-link'
      bg={active ? 'dark.4' : 'inherit'}
      active={active}
    />
  );
}
