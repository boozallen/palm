import { useRouter } from 'next/router';
import { useState, useRef } from 'react';
import { default as ConfirmExitModal } from '@/features/library/components/SafeExitModal';
import { SafeExitProvider } from '@/features/shared/utils';

export const useSafeExitModal = () => {
  const [open, setOpen] = useState(false);
  const linkRef = useRef<string|URL|HTMLElement|null>(null);
  const safeExitElementIsDirtyRef = useRef<boolean>(false);
  const router = useRouter();

  const handleLeave = () => {
    if (typeof linkRef.current === 'string') {
      if (linkRef.current !== router.asPath) {
        router.push(linkRef.current);
      }
    }
    setSafeExitFormToDirty(false);
    setOpen(false);
  };
  
  const handleCancel = () => {
    setOpen(false);
  };
  
  const openModal = (route: string) => {
    if (safeExitElementIsDirtyRef.current) {
      if (route !== router.asPath) {
        setOpen(true);
      }
      linkRef.current = route;
    } else {
      router.push(route);
    }
  };
      
  const SafeExitModal = () => {
    return (
      <ConfirmExitModal
        isOpen={open}
        onLeave={handleLeave}
        onCancel={handleCancel}
      />
    );
  };

  function setSafeExitFormToDirty(dirtiness: boolean = false) {
    safeExitElementIsDirtyRef.current = dirtiness;
  };

  // SafeExitProvider: The context provider for safe exit
  // SafeExitModal: The modal component for safe exit
  // setSafeExitFormToDirty: sets the dirtiness reference
  // openModal: opens the safe exit modal if form is dirty
  return { 
    SafeExitProvider, 
    SafeExitModal, 
    setSafeExitFormToDirty, 
    openModal,
  };
};
