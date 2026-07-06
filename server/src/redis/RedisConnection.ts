import { Redis } from 'ioredis';

export class RedisConnection {
  private static instance: RedisConnection | null = null;

  private readonly client: Redis;
  private readonly subscriber: Redis;

  private constructor() {
    this.client = this.createClient();
    this.subscriber = this.createClient();

    this.attachLogs(this.client, 'Redis');
    this.attachLogs(this.subscriber, 'Redis subscriber');
  }

  static getInstance(): RedisConnection {
    RedisConnection.instance ??= new RedisConnection();
    return RedisConnection.instance;
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.subscriber.quit(), this.client.quit()]);
    RedisConnection.instance = null;
  }

  private createClient(): Redis {
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

  private attachLogs(client: Redis, label: string): void {
    client.on('connect', () => {
      console.log(`${label} conectado`);
    });

    client.on('error', (error: Error) => {
      console.error(`Erro no ${label}:`, error);
    });
  }
}
