import React from 'react';
import { Flex } from '@mantine/core';

type ChatLayoutProps = {
  children: React.ReactNode;
};

export default function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <Flex
      h={'100vh'}
      bg='dark.8'
      gap={0}
      justify={'space-between'}
      direction='column'
      wrap='nowrap'
    >
      {children}
    </Flex>
  );
}
