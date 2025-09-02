import { NavLink } from '@mantine/core';
import { IconChartInfographic } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import SafeExit from './SafeExit';

export default function AnalyticsNavLink() {
  const router = useRouter();
  const active = router.asPath.startsWith('/analytics');

  return (
    <NavLink
      label='Analytics'
      component={SafeExit}
      href='/analytics'
      icon={<IconChartInfographic stroke={1.5} />}
      bg={active ? 'dark.4' : 'inherit'}
      active={active}
    />
  );
}
