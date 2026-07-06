import express from 'express';
import type { Response } from 'express';
import cors from 'cors';
import { RedisConnection } from './redis/RedisConnection.js';

const app = express();

app.use(express.json());

const port = Number(process.env.PORT) || 3000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const notificationsChannel = 'notifications';

const redisConnection = RedisConnection.getInstance();
const redis = redisConnection.getClient();
const subscriber = redisConnection.getSubscriber();

const clients = new Set<Response>();

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
  await redisConnection.disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
