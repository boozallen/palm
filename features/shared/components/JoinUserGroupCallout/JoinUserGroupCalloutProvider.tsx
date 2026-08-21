import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import useGetUserGroups from '@/features/profile/api/get-user-groups';
import { UiPreference } from '@/types/ui-preferences';

type JoinUserGroupCalloutContextValue = {
  isNonMember: boolean;
  collapsed: boolean;
  collapse: () => void;
  expand: () => void;
  focusRequestId: number;
  requestExpandAndFocus: () => void;
  blockingModalOpen: boolean;
  setBlockingModalOpen: (open: boolean) => void;
};

const JoinUserGroupCalloutContext = createContext<JoinUserGroupCalloutContextValue | null>(null);

export function JoinUserGroupCalloutProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [collapsed, setCollapsed] = useState(false);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [blockingModalOpen, setBlockingModalOpen] = useState(false);
  const hydrated = useRef(false);

  const { data: userGroups } = useGetUserGroups();
  const isNonMember = userGroups !== undefined && userGroups.userGroups.length === 0;

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      setCollapsed(localStorage.getItem(UiPreference.JOIN_USER_GROUP_DIALOG_COLLAPSED) === 'true');
    }
  }, []);

  const collapse = useCallback(() => {
    setCollapsed(true);
    localStorage.setItem(UiPreference.JOIN_USER_GROUP_DIALOG_COLLAPSED, 'true');
  }, []);

  const expand = useCallback(() => {
    setCollapsed(false);
    localStorage.setItem(UiPreference.JOIN_USER_GROUP_DIALOG_COLLAPSED, 'false');
  }, []);

  const requestExpandAndFocus = useCallback(() => {
    expand();
    setFocusRequestId((id) => id + 1);
  }, [expand]);

  return (
    <JoinUserGroupCalloutContext.Provider
      value={{
        isNonMember,
        collapsed,
        collapse,
        expand,
        focusRequestId,
        requestExpandAndFocus,
        blockingModalOpen,
        setBlockingModalOpen,
      }}
    >
      {children}
    </JoinUserGroupCalloutContext.Provider>
  );
}

export function useJoinUserGroupCallout() {
  const context = useContext(JoinUserGroupCalloutContext);
  if (!context) {
    throw new Error('useJoinUserGroupCallout must be used within a JoinUserGroupCalloutProvider');
  }
  return context;
}
