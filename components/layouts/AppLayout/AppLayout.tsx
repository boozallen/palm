import MenuBar from '@/components/navbar/MenuBar';
import AppHead from '@/components/layouts/AppHead';
import {
  AppShell,
} from '@mantine/core';
import React from 'react';

type AppLayoutProps = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
 
  return (
    <>
      <AppHead />
      <AppShell
        padding={0}
        navbar={
          <MenuBar />
        }
      >
        {children}
      </AppShell>
    </>
  );
}
