import React, { Suspense } from 'react';
import AppMantineProvider from './AppMantineProvider';
import FormSafeExitProvider from './FormSafeExitProvider';
import { CookiesProvider } from 'react-cookie';
import { ModalsProvider } from '@mantine/modals';

type AppProviderProps = {
  children: React.ReactNode;
};
export default function AppProvider({ children }: AppProviderProps) {
  return (
    <Suspense fallback={<div />}>
      <AppMantineProvider>
        <ModalsProvider>
          <CookiesProvider>
            <FormSafeExitProvider>
              {children}
            </FormSafeExitProvider>
          </CookiesProvider>
        </ModalsProvider>
      </AppMantineProvider>
    </Suspense>
  );
}
