import React, { useEffect, useState } from 'react';
import { useJoinUserGroupCallout } from '@/features/shared/components/JoinUserGroupCallout/JoinUserGroupCalloutProvider';
import JoinUserGroupDialog from '@/features/shared/components/JoinUserGroupCallout/JoinUserGroupDialog';

type JoinUserGroupWrapProps = Readonly<{
  children: React.ReactNode;
}>;

const DIALOG_APPEARANCE_DELAY_MS = 2000;

export default function JoinUserGroupWrap({ children }: JoinUserGroupWrapProps) {
  const { isNonMember, collapsed, collapse, expand, focusRequestId, blockingModalOpen } =
    useJoinUserGroupCallout();
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    if (!isNonMember) {
      setDelayElapsed(false);
      return;
    }

    const timeout = setTimeout(() => setDelayElapsed(true), DIALOG_APPEARANCE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [isNonMember]);

  return (
    <>
      {children}
      <JoinUserGroupDialog
        opened={isNonMember && delayElapsed && !blockingModalOpen}
        collapsed={collapsed}
        focusRequestId={focusRequestId}
        onCollapse={collapse}
        onExpand={expand}
      />
    </>
  );
}
