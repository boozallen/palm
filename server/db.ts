// From Prisma Docs : https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices

import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/server/config';

const config = getConfig();

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>; // eslint-disable-line
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (config.nodeEnv !== 'production') {
  globalThis.prisma = prisma;
} 
