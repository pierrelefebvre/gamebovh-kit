/** Seau à jetons : `rate` messages par seconde, rafale jusqu'à `burst`. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly rate: number,
    private readonly burst: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = burst;
    this.last = now();
  }

  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.burst, this.tokens + ((t - this.last) / 1000) * this.rate);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export interface ServerConfig {
  port: number;
  allowedOrigins: string[] | '*';
  maxRooms: number;
  maxConnections: number;
  messagesPerSecond: number;
  heartbeatMs: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const origins = (env.ALLOWED_ORIGINS ?? '*').trim();
  return {
    port: Number(env.PORT ?? 8787),
    allowedOrigins:
      origins === '*' || origins === ''
        ? '*'
        : origins.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
    maxRooms: Number(env.MAX_ROOMS ?? 500),
    maxConnections: Number(env.MAX_CONNECTIONS ?? 2000),
    messagesPerSecond: Number(env.MESSAGES_PER_SECOND ?? 60),
    heartbeatMs: 15_000,
  };
}
