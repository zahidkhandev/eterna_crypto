import { PrismaClient } from './generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

export * from './generated/client/client';
