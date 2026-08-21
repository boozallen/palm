import { useRouter } from 'next/router';
import React, { useCallback, useContext } from 'react';
import { Box } from '@mantine/core';
import { SafeExitContext } from '@/features/shared/utils';

interface SafeExitProps {
  children: React.ReactNode;
  href?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
  'data-testid'?: string;
}
function SafeExit({ 
  children, 
  title, 
  href = '/', 
  className, 
  onClick: handleParentClick = undefined, 
  ...rest 
}: Readonly<SafeExitProps>) {
  
  const { openModal } = useContext(SafeExitContext);
  const router = useRouter();

  const handleSafeExit = useCallback(() => {
    if (typeof handleParentClick === 'function') {
      handleParentClick();
    }
    if (openModal) {
      openModal(href);
    } else {
      router.push(href);
    }
  }, [handleParentClick, openModal, href, router]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      event.stopPropagation();
      handleSafeExit();
    }
  };

  // Destructure data-testid so we can set it
  const { 'data-testid': testId } = rest;
  const finalTestId = testId || 'safeExit';

  return (
    <Box 
      data-testid={finalTestId}
      className={className}
      tabIndex={0}
      onClick={handleSafeExit}
      onKeyDown={handleKeyDown}
      title={title}
    >
      {children}
    </Box>
  );
};
export default SafeExit;
