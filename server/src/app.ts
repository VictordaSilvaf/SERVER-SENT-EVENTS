import express from 'express';
import type { Response } from 'express';
import cors from 'cors';
import { Redis } from 'ioredis';

const app = express();

app.use(express.json());

const port = Number(process.env.PORT) || 3000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const notificationsChannel = 'notifications';

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    return new Redis(redisUrl);
  }

  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB) || 0,
  });
}

const redis = createRedisClient();
const subscriber = createRedisClient();

function attachRedisLogs(client: Redis, label: string) {
  client.on('connect', () => {
    console.log(`${label} conectado`);
  });

  client.on('error', (error: Error) => {
    console.error(`Erro no ${label}:`, error);
  });
}

attachRedisLogs(redis, 'Redis');
attachRedisLogs(subscriber, 'Redis subscriber');

subscriber.on('message', (_channel, message) => {
  for (const client of clients) {
    client.write(`event: notification\ndata: ${message}\n\n`);
  }
});

void subscriber.subscribe(notificationsChannel);

app.use(
  cors({
    origin: corsOrigin,
  }),
);

const clients = new Set<Response>();

app.get('/health', async (_req, res) => {
  try {
    const pong = await redis.ping();

    res.json({
      status: 'OK',
      redis: pong === 'PONG' ? 'connected' : 'unknown',
    });
  } catch {
    res.status(503).json({
      status: 'ERROR',
      redis: 'disconnected',
    });
  }
});

app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.flushHeaders();
  res.write(': connected\n\n');

  clients.add(res);
  console.log(`Cliente conectado (${clients.size} online)`);

  req.on('close', () => {
    clients.delete(res);
    console.log(`Cliente desconectado (${clients.size} online)`);
    res.end();
  });
});

setInterval(() => {
  for (const client of clients) {
    client.write(': ping\n\n');
  }
}, 15000);

const shutdown = async () => {
  await subscriber.quit();
  await redis.quit();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
