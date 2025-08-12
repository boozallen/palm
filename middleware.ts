import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { UserRole } from '@/features/shared/types/user';

import { getConfig } from '@/server/config';

export default async function middleware(req: NextRequest) {
  const config = getConfig();
  const useSecureCookies = config.enableSecureCookies;

  const token = await getToken({ req, secureCookie: useSecureCookies });

  if (!token) {
    return NextResponse.redirect(new URL('/api/auth/signin', req.url));
  }

  if (token.role !== UserRole.Admin) {
    const path = req.nextUrl.pathname;

    if (path === '/analytics') {
      return NextResponse.redirect(new URL('/404', req.url));
    }

    else if (path.startsWith('/settings')) {
      // Check is user a Lead of *any* user group
      if (!token.isUserGroupLead) {
        return NextResponse.redirect(new URL('/404', req.url));
      }
    }
  }
}

// https://nextjs.org/docs/pages/building-your-application/routing/middleware#matching-paths
// Commented out routes are protected via next-auth
export const config = {
  matcher: [
    '/analytics',
    '/settings/:path*',
    // /chat/:path*
    // /legal
    // /library/:path*
    // /profile
    // /prompt-generator
    // /prompt-playground
  ],
};
