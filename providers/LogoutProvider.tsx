import { createContext, useContext, useState } from 'react';

type LogoutProviderProps = {
  children: React.ReactNode;
};

const defaultLogoutStatus = {
  isUserLoggingOut: false,
  setIsUserLoggingOut: (() => { }) as React.Dispatch<React.SetStateAction<boolean>>,
};

const LogoutContext = createContext(defaultLogoutStatus);

export const LogoutProvider = ({ children }: LogoutProviderProps) => {

  const [isUserLoggingOut, setIsUserLoggingOut] = useState(false);

  return (
    <LogoutContext.Provider value={{ isUserLoggingOut, setIsUserLoggingOut }}>
      {children}
    </LogoutContext.Provider>
  );

};

export const useLogout = () => useContext(LogoutContext);
