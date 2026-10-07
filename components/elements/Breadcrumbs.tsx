import { Anchor, Box, Breadcrumbs as MBreadcrumbs, Text } from '@mantine/core';
import Link from 'next/link';

import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type BreadcrumbsProps = {
  links: Array<{
    title: string;
    href: string | null;
  }>;
};

export default function Breadcrumbs({
  links,
}: BreadcrumbsProps) {
  const track = useTrackClientEvent();

  const breadcrumbs = links.map(({ title, href }) => {
    if (!href) {
      return <Text c='gray.6' key={title}>{title}</Text>;
    }

    return (
      <Anchor
        href={href}
        key={title}
        component={Link}
        onClick={() => track.navigate(title, href)}
      >
        {title}
      </Anchor>
    );
  });

  return (
    <Box my='xs'>
      <MBreadcrumbs>{breadcrumbs}</MBreadcrumbs>
    </Box>
  );
}
