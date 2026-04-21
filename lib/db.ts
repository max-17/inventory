import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Prisma 7 + Neon + Vercel (HTTP/Fetch Mode)
 *
 * We use 'Pool' from @neondatabase/serverless and force 'poolQueryViaFetch'
 * to ensure compatibility with Vercel Serverless and Edge functions without WebSockets.
 */

// Enable querying over fetch (HTTP)
neonConfig.poolQueryViaFetch = true;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Create the connection pool and adapter
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ["query", "error", "warn"],
    transactionOptions: {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 15_000,
      timeout: 20_000,
    },
  });

if (process.env.NODE_ENV === "development") globalForPrisma.prisma = db;
