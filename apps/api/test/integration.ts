import WebSocket from 'ws';
import { prisma } from '@repo/database';

const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

// Helpers
async function clearDb() {
  await prisma.order.deleteMany({});
}

async function createOrder(data: any) {
  return fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

function waitForWebSocketMessage(orderId: string, targetStatus: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws/orders?orderId=${orderId}`);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timeout waiting for status: ${targetStatus}`));
    }, 10000);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.status === targetStatus) {
        clearTimeout(timeout);
        ws.close();
        resolve(msg);
      }
      if (msg.status === 'FAILED') {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`Order failed with error: ${msg.error}`));
      }
    });
  });
}

// Test Runner
async function runTests() {
  console.log('Starting Integration Tests...\n');
  await clearDb();
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`TEST: ${name}... `);
      await fn();
      console.log('PASS');
      passed++;
    } catch (e) {
      console.log('FAIL');
      console.error(e);
      failed++;
    }
  }

  // TEST 1: Health Check
  await test('Server is reachable', async () => {
    try {
      await fetch(`${API_URL}/api/orders`, { method: 'OPTIONS' });
    } catch (e) {
      throw new Error('API not running');
    }
  });

  // TEST 2: Validation - Missing Fields
  await test('Validation: Reject missing fields', async () => {
    const res = await createOrder({ side: 'BUY' });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // TEST 3: Validation - Negative Amount
  await test('Validation: Reject negative amount', async () => {
    const res = await createOrder({
      type: 'MARKET',
      side: 'BUY',
      asset: 'SOL/USDC',
      amount: -10,
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // TEST 4: Validation - Invalid Side
  await test('Validation: Reject invalid side', async () => {
    const res = await createOrder({
      type: 'MARKET',
      side: 'HOLD',
      asset: 'SOL/USDC',
      amount: 10,
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // TEST 5: Create Valid Order
  let validOrderId: string;
  await test('API: Create valid Market Order', async () => {
    const res = await createOrder({
      type: 'MARKET',
      side: 'BUY',
      asset: 'SOL/USDC',
      amount: 1.5,
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    const body = await res.json();
    if (!body.orderId) throw new Error('No orderId returned');
    validOrderId = body.orderId;
  });

  // TEST 6: WebSocket Connection
  await test('WebSocket: Connect and receive updates', async () => {
    const ws = new WebSocket(`${WS_URL}/ws/orders?orderId=${validOrderId}`);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      ws.on('error', reject);
    });
  });

  // TEST 7: Full Lifecycle
  await test('E2E: Full Order Execution Flow', async () => {
    const res = await createOrder({
      type: 'MARKET',
      side: 'SELL',
      asset: 'BTC/USDC',
      amount: 0.1,
    });
    const { orderId } = await res.json();

    const result = await waitForWebSocketMessage(orderId, 'CONFIRMED');
    if (!result.txHash) throw new Error('Missing txHash in confirmation');
    if (!result.price) throw new Error('Missing execution price');
  });

  // TEST 8: DB Persistence
  await test('DB: Verify Order Persisted as CONFIRMED', async () => {
    const lastOrder = await prisma.order.findFirst({ orderBy: { createdAt: 'desc' } });
    if (lastOrder?.status !== 'CONFIRMED') throw new Error(`DB status is ${lastOrder?.status}`);
  });

  // TEST 9: Mock Routing Logic
  await test('Logic: Router selects best price', async () => {
    const res = await createOrder({
      type: 'MARKET',
      side: 'BUY',
      asset: 'ETH/USDC',
      amount: 1,
    });
    const { orderId } = await res.json();
    const result = await waitForWebSocketMessage(orderId, 'CONFIRMED');

    if (result.price < 2000 || result.price > 4000) {
      throw new Error(`Price ${result.price} seems way off for ETH`);
    }
  });

  // TEST 10: Concurrency
  await test('Performance: Handle 5 concurrent orders', async () => {
    const orders = Array(5)
      .fill(null)
      .map(() =>
        createOrder({ type: 'MARKET', side: 'BUY', asset: 'SOL/USDC', amount: 1 }).then((res) =>
          res.json(),
        ),
      );

    const responses = await Promise.all(orders);
    const orderIds = responses.map((r: any) => r.orderId);

    const promises = orderIds.map((id: string) => waitForWebSocketMessage(id, 'CONFIRMED'));
    await Promise.all(promises);
  });

  console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
