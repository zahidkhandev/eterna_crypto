import { Worker, Job } from 'bullmq';
import { redis, prisma } from '@repo/database';
import { MockDexRouter } from '@repo/router';
import type { OrderInput } from '@repo/types';

const WORKER_QUEUE_NAME = 'order-processing';
const dexRouter = new MockDexRouter();

async function updateStatus(orderId: string, status: string, data: any = {}) {
  await prisma.order.update({
    where: { id: orderId },
    data: { status, ...data },
  });

  const message = JSON.stringify({ orderId, status, ...data });
  await redis.publish(`order-updates:${orderId}`, message);
}

const worker = new Worker(
  WORKER_QUEUE_NAME,
  async (job: Job<OrderInput & { orderId: string }>) => {
    const { orderId, asset, amount, side } = job.data;

    try {
      await updateStatus(orderId, 'ROUTING');
      const quotes = await dexRouter.getQuotes(asset, amount, side);

      const bestQuote = quotes.reduce((prev, curr) => {
        if (side === 'BUY') return curr.price < prev.price ? curr : prev;
        return curr.price > prev.price ? curr : prev;
      });

      await updateStatus(orderId, 'BUILDING', {
        dex: bestQuote.dex,
        price: bestQuote.price,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await updateStatus(orderId, 'SUBMITTED');

      const execution = await dexRouter.executeSwap(bestQuote.dex, asset, amount, side);

      if (execution.success) {
        await updateStatus(orderId, 'CONFIRMED', {
          txHash: execution.txHash,
          price: execution.executedPrice,
        });
      } else {
        throw new Error('Execution failed on-chain');
      }

      return execution;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await updateStatus(orderId, 'FAILED', { error: errorMessage });
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 60000,
    },
  },
);

console.log('Worker started. Listening for jobs...');
