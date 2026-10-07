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
import { JoinUserGroupCalloutProvider } from '@/features/shared/components/JoinUserGroupCallout/JoinUserGroupCalloutProvider';
import { AppErrorBoundary } from '@/components/layouts/AppErrorBoundary';
import GlobalErrorListener from '@/components/layouts/GlobalErrorListener';
import { UserGroupAttributionProvider } from '@/features/shared/providers/UserGroupAttribution/UserGroupAttributionProvider';

const AuthWrap = dynamic(() => import('@/components/layouts/AuthWrap'), {
  ssr: false,
});

const ClickWrap = dynamic(() => import('@/components/layouts/ClickWrap'), {
  ssr: false,
});

const FirstLoginWrap = dynamic(() => import('@/components/layouts/FirstLoginWrap'), {
  ssr: false,
});

const JoinUserGroupWrap = dynamic(() => import('@/components/layouts/JoinUserGroupWrap'), {
  ssr: false,
});

function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <AppProvider>
        <GlobalErrorListener />
        <AppErrorBoundary>
          <LogoutProvider>
            <AuthWrap>
              <IdleLogoutWrap>
                <ClickWrap>
                  <FirstLoginWrap>
                    <JoinUserGroupCalloutProvider>
                      <JoinUserGroupWrap>
                        <UserBookmarksProvider>
                          <ProfileProvider>
                            <SettingsProvider>
                              <UserGroupAttributionProvider>
                                <AppLayout>
                                  <Component {...pageProps} />
                                </AppLayout>
                              </UserGroupAttributionProvider>
                            </SettingsProvider>
                          </ProfileProvider>
                        </UserBookmarksProvider>
                      </JoinUserGroupWrap>
                    </JoinUserGroupCalloutProvider>
                  </FirstLoginWrap>
                </ClickWrap>
              </IdleLogoutWrap>
            </AuthWrap>
          </LogoutProvider>
        </AppErrorBoundary>
      </AppProvider>
    </SessionProvider>
  );
}

export default trpc.withTRPC(App);
