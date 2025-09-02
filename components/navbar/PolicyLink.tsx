import { Anchor } from '@mantine/core';
import { useRouter } from 'next/router';

export default function PolicyLink() {
  const router = useRouter();

  const handleLegalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    router.push('/legal');
  };
  
  return (
    <Anchor onClick={handleLegalClick} href='/legal' pl='sm' size='xs'>
      Legal Policies
    </Anchor>
  );
}
