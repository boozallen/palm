import { DefaultJWT } from 'next-auth/jwt';
import { UserRole } from '@/features/shared/types/user';

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string,
    } & User,
  }

  interface User {
    role: UserRole,
    lastLoginAt?: Date | null,
  }

  /** The OAuth profile returned from your provider */
  interface Profile {
    sub?: string,
    name?: string,
    email?: string,
    image?: string,
  }
}

declare module 'next-auth/jwt' {
  /**
   * Returned by the jwt callback and getToken, when using JWT sessions
   */
  interface JWT extends DefaultJWT {
    role: UserRole,
    isUserGroupLead: boolean,
    lastLoginAt?: Date | null,
  }
}
