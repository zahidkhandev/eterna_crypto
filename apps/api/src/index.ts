import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { Queue } from 'bullmq';
import { redis, prisma } from '@repo/database';
import { OrderSchema } from '@repo/types';
import { z } from 'zod';

const app = Fastify({ logger: true });

const orderQueue = new Queue('order-processing', {
  connection: redis,
});

app.register(websocket);

app.register(async (fastify) => {
  fastify.get('/ws/orders', { websocket: true }, (connection, req) => {
    const { orderId } = req.query as { orderId?: string };

    if (!orderId) {
      connection.socket.send(JSON.stringify({ error: 'Missing orderId' }));
      connection.socket.close();
      return;
    }

    const subscriber = redis.duplicate();
    subscriber.subscribe(`order-updates:${orderId}`);

    subscriber.on('message', (channel, message) => {
      connection.socket.send(message);

      const parsed = JSON.parse(message);
      if (['CONFIRMED', 'FAILED'].includes(parsed.status)) {
        subscriber.unsubscribe();
        subscriber.quit();
      }
    });

    connection.socket.on('close', () => {
      subscriber.unsubscribe();
      subscriber.quit();
    });
  });
});

app.post('/api/orders', async (req, reply) => {
  try {
    const payload = OrderSchema.parse(req.body);

    const order = await prisma.order.create({
      data: {
        type: payload.type,
        side: payload.side,
        asset: payload.asset,
        amount: payload.amount,
        status: 'PENDING',
      },
    });

    await orderQueue.add(
      'process-order',
      {
        orderId: order.id,
        ...payload,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    return reply.status(201).send({
      message: 'Order received',
      orderId: order.id,
      status: 'PENDING',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Validation failed', details: error.issues });
    }
    app.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('API Server running at http://localhost:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
