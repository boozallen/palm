import { useEffect, useMemo, useState, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useIdle } from '@mantine/hooks';

import { UserRole, UserRoleIdleTimeMS, UserIdleTimeWarningOffsetMS } from '@/features/shared/types/user';
import { useLogout } from '@/providers/LogoutProvider';
import IdleLogoutWarningModal from '@/features/shared/components/modals/IdleLogoutWarningModal';

type IdleLogoutWrapProps = Readonly<{
  children: React.ReactNode;
}>;

export default function IdleLogoutWrap({ children }: IdleLogoutWrapProps) {
  const { data: session } = useSession();
  const { setIsUserLoggingOut } = useLogout();

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [timeRemainingMS, setTimeRemainingMS] = useState(0);
  const [sessionExtended, setSessionExtended] = useState(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const maxIdleTime = useMemo(() => {
    return session?.user.role === UserRole.Admin ? UserRoleIdleTimeMS.Admin : UserRoleIdleTimeMS.User;
  }, [session?.user.role]);

  const warningTime = useMemo(() => {
    return maxIdleTime - UserIdleTimeWarningOffsetMS;
  }, [maxIdleTime]);

  // True after user is idle for warning time
  const userIsIdleForWarning = useIdle(warningTime, { initialState: false });
  
  // True after user is idle for logout time
  const userIsIdleForLogout = useIdle(maxIdleTime, { initialState: false });

  // Handle extending session
  const handleExtendSession = () => {
    setShowWarningModal(false);
    setSessionExtended(true);
    
    // Clear timers
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    // Reset the session extended flag after a short delay to allow idle detection to restart
    setTimeout(() => {
      setSessionExtended(false);
    }, 100);
  };

  // Handle warning modal display
  useEffect(() => {
    if (userIsIdleForWarning && !sessionExtended && !showWarningModal) {
      setShowWarningModal(true);
      setTimeRemainingMS(UserIdleTimeWarningOffsetMS);

      // Start countdown timer
      countdownTimerRef.current = setInterval(() => {
        setTimeRemainingMS(prev => {
          if (prev <= 1000) {
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
  }, [userIsIdleForWarning, sessionExtended, showWarningModal]);

  // Handle logout
  useEffect(() => {
    if (userIsIdleForLogout && !sessionExtended) {
      setShowWarningModal(false);
      signOut({ redirect: false })
        .then(() => {
          setIsUserLoggingOut(true);
        });
    }
  }, [userIsIdleForLogout, sessionExtended, setIsUserLoggingOut]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      {children}
      <IdleLogoutWarningModal
        isOpen={showWarningModal}
        onExtendSession={handleExtendSession}
        timeRemainingMS={timeRemainingMS}
      />
    </>
  );
}
