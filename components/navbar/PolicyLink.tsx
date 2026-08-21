import { Anchor } from '@mantine/core';
import { useRouter } from 'next/router';

import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

interface PolicyLinkProps {
  isCollapsed?: boolean;
}

export default function PolicyLink({ isCollapsed = false }: PolicyLinkProps) {
  const router = useRouter();
  const track = useTrackClientEvent();

  const handleLegalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    track.navigate('Legal Policies', '/legal');
    router.push('/legal');
  };
  
  if (isCollapsed) {
    return null; // Hide policy link in collapsed state to save space
  }
  
  return (
    <Anchor onClick={handleLegalClick} title='Legal Policies' href='/legal' pl='sm' size='xs'>
      Legal Policies
    </Anchor>
  );
}
