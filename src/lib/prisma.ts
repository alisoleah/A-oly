/**
 * Prisma client singleton.
 *
 * Next.js dev hot-reloads modules, which would create a new PrismaClient per
 * reload and exhaust DB connections. We cache one instance on globalThis.
 *
 * CLAUDE.md mandates Prisma exclusively (flag any $queryRaw interpolation);
 * this module is the only place a client is constructed.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
