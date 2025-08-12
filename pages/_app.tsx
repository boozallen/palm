import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import AppProvider from '@/providers/AppProvider';
import AppLayout from '@/components/layouts/AppLayout/AppLayout';
import { trpc } from '@/libs';
import { SessionProvider } from 'next-auth/react';
import { UserBookmarksProvider } from '@/components/layouts/UserBookmarks';
import ProfileProvider from '@/providers/ProfileProvider';
import SettingsProvider from '@/providers/SettingsProvider';
import { LogoutProvider } from '@/providers/LogoutProvider';
import IdleLogoutWrap from '@/components/layouts/IdleLogoutWrap';

const AuthWrap = dynamic(() => import('@/components/layouts/AuthWrap'), {
  ssr: false,
});

const ClickWrap = dynamic(() => import('@/components/layouts/ClickWrap'), {
  ssr: false,
});

const FirstLoginWrap = dynamic(() => import('@/components/layouts/FirstLoginWrap'), {
  ssr: false,
});

function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <AppProvider>
        <LogoutProvider>
          <AuthWrap>
            <IdleLogoutWrap>
              <ClickWrap>
                <FirstLoginWrap>
                  <UserBookmarksProvider>
                    <ProfileProvider>
                      <SettingsProvider>
                        <AppLayout>
                          <Component {...pageProps} />
                        </AppLayout>
                      </SettingsProvider>
                    </ProfileProvider>
                  </UserBookmarksProvider>
                </FirstLoginWrap>
              </ClickWrap>
            </IdleLogoutWrap>
          </AuthWrap>
        </LogoutProvider>
      </AppProvider>
    </SessionProvider>
  );
}

export default trpc.withTRPC(App);
