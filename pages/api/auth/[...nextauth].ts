import NextAuth from 'next-auth';

import { authOptions } from '@/server/auth-adapter';

export default NextAuth(authOptions);
