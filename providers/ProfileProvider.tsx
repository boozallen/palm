import React, { createContext, useState } from 'react';

const ProfileContext = createContext<any>(undefined);

const Provider = ProfileContext.Provider;

const ProfileProvider = ({ children }: { children: React.ReactNode }) => {

  const [activeProfileTab, setActiveProfileTab] = useState<string | null>(null);

  return (
    <Provider value={{ activeProfileTab, setActiveProfileTab }}>
      {children}
    </Provider>
  );
};

export default ProfileProvider;

// create use hook for provider
export const useProfile = () => {
  const context = React.useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('An unexpected error occurred. Please try again later.');
  }
  return context;
};
