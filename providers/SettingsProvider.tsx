import React, { createContext, useState } from 'react';

type SettingsContextType = {
  activeSettingsTab: string | null;
  setActiveSettingsTab: React.Dispatch<React.SetStateAction<string | null>>;
};

const settingsContextState = {
  activeSettingsTab: null,
  setActiveSettingsTab: () => { },
};

type SettingsProviderProps = Readonly<{
  children: React.ReactNode;
}>;

const SettingsContext = createContext<SettingsContextType>(settingsContextState);

const Provider = SettingsContext.Provider;

export default function SettingsProvider({ children }: SettingsProviderProps) {

  const [activeSettingsTab, setActiveSettingsTab] = useState<string | null>(null);

  return (
    <Provider value={{ activeSettingsTab, setActiveSettingsTab }}>
      {children}
    </Provider>
  );
};

// create use hook for provider
export const useSettings = () => {
  const context = React.useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('An unexpected error occurred. Please try again later.');
  }
  return context;
};
