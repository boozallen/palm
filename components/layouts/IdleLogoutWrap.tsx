import { useEffect, useMemo } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useIdle } from '@mantine/hooks';
import { UserRole, UserRoleIdleTimeMS } from '@/features/shared/types/user';
import { useLogout } from '@/providers/LogoutProvider';

type IdleLogoutWrapProps = Readonly<{
  children: React.ReactNode;
}>;

export default function IdleLogoutWrap({ children }: IdleLogoutWrapProps) {
  const { data: session } = useSession();

  const { setIsUserLoggingOut } = useLogout();

  const maxIdleTime = useMemo(() => {
    return session?.user.role === UserRole.Admin ? UserRoleIdleTimeMS.Admin : UserRoleIdleTimeMS.User;
  }, [session?.user.role]);

  // True after user is idle for a set time
  const userIsIdle = useIdle(maxIdleTime, { initialState: false });

  useEffect(() => {
    if (userIsIdle) {
      signOut({ redirect: false })
        .then(() => {
          setIsUserLoggingOut(true);
        });
    }
  }, [userIsIdle, setIsUserLoggingOut]);

  return (
    <>{children}</>
  );
}
