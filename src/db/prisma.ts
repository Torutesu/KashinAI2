// src/db/prisma.ts
import { PrismaClient } from '@prisma/client';

// Global singleton to prevent multiple PrismaClient instances in development (hot-reloading)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;