import { NavLink, Tooltip } from '@mantine/core';
import { useRouter } from 'next/router';
import SafeExit from '@/components/navbar/SafeExit';

interface NavLinkItemProps {
  isCollapsed?: boolean;
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  testId?: string;
}

export default function NavLinkItem({ 
  isCollapsed = false, 
  href, 
  icon, 
  label, 
  description,
  testId,
}: NavLinkItemProps) {
  const router = useRouter();
  const active = router.asPath.startsWith(href);
  
  return isCollapsed ? (
    <Tooltip label={label} position='right' openDelay={0} zIndex={1000} withinPortal>
      <div>
        <NavLink
          label={undefined}
          description={undefined}
          component={SafeExit}
          href={href}
          icon={icon}
          data-testid={testId}
          bg={active ? 'dark.3' : 'inherit'}
          active={active}
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
      label={label}
      description={description}
      component={SafeExit}
      href={href}
      icon={icon}
      data-testid={testId}
      bg={active ? 'dark.4' : 'inherit'}
      active={active}
      title={label}
      styles={(theme) => ({
        root: {
          '&:hover': {
            backgroundColor: theme.colors.dark[8],
          },
        },
      })}
    />
  );
}
