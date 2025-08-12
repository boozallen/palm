import { createContext } from 'react';

type SafeExitContextValue = {
  // Opens a modal with the provided URL
  openModal: (url: string) => void;
  // Sets the form's dirtiness status
  setSafeExitFormToDirty: (dirtiness: boolean) => void;
};

export const SafeExitContext = createContext<SafeExitContextValue>({ openModal: () => null,  setSafeExitFormToDirty: () => null });
export const SafeExitProvider = SafeExitContext.Provider;
