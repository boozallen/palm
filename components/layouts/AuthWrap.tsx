import { useSession } from 'next-auth/react';
import React, { createContext, useEffect } from 'react';
import { ISODateString } from 'next-auth';
import { useRouter } from 'next/router';
import { useLogout } from '@/providers/LogoutProvider';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

type AuthWrapProps = {
  children: React.ReactNode;
};

interface UserSession {
  user: {
    name: string,
    email: string,
    image: string,
    lastLoginAt?: Date | null,

  },
  expires: ISODateString
}

const defaultUser: UserSession = {
  user: {
    name: 'No name provided',
    email: 'No email provided',
    image: '/',
    lastLoginAt: null,
  },
  expires: new Date().toISOString(),
};

export const UserSessionContext = createContext(defaultUser);

export default function AuthWrap({ children }: AuthWrapProps) {
  const { data: session, status } = useSession();
  const loading = status === 'loading';
  const { isUserLoggingOut, setIsUserLoggingOut } = useLogout();
  const router = useRouter();

  const unauthenticated = !loading && !session && status === 'unauthenticated';
  const authenticated = !loading && session && status === 'authenticated';

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isUserLoggingOut) {
      if (unauthenticated) {
        notifications.show({
          title: 'You Have Logged Out',
          message: 'To access this system again, please log in with your credentials.',
          icon: <IconCheck />,
          variant: 'successful_operation',
        });
        timeoutId = setTimeout(() => {
          setIsUserLoggingOut(false);
          router.push('/api/auth/signin');
        }, 3000);
      } else if (authenticated) {
        notifications.show({
          title: 'Failed To Logout',
          message: 'Unable to logout. Please try again.',
          icon: <IconX />,
          variant: 'failed_operation',
        });
      }
      return () => clearTimeout(timeoutId);
    }
    else if (unauthenticated) {
      router.push('/api/auth/signin');
    }
  }, [authenticated, unauthenticated, router, isUserLoggingOut, setIsUserLoggingOut]);

  if (authenticated) {
    return (
      <UserSessionContext.Provider value={session as UserSession}>
        {children}
      </UserSessionContext.Provider>);
  }

  return (
    <></>
  );
}
