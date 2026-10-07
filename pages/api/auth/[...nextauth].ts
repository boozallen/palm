import NextAuth from 'next-auth';
import type { NextApiRequest, NextApiResponse } from 'next';

import { authOptions } from '@/server/auth-adapter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return await NextAuth(req, res, await authOptions());
}
