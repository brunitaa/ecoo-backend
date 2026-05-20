import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default prisma;

/** Transacción interactiva Prisma (reemplaza BEGIN/COMMIT manual) */
export function withTransaction(fn) {
  return prisma.$transaction(fn, {
    maxWait: 10000,
    timeout: 30000,
  });
}
