import { env as workerEnv } from 'cloudflare:workers';
import { withLatency } from './dev-latency';

/**
 * The Worker env. In development DEV_DB_LATENCY_MS slows the database to production's
 * round trip (dev-latency.ts), so local timings mean something.
 */
let cached: ToolEnv | undefined;
export function getEnv(): ToolEnv {
  if (cached) return cached;
  const env = workerEnv as unknown as ToolEnv;
  const ms = import.meta.env.DEV ? Number(env.DEV_DB_LATENCY_MS ?? 0) : 0;
  cached = ms ? { ...env, DB: withLatency(env.DB, ms) } : env;
  return cached;
}

/** A path inside this Tool, with its base (/gifts). */
export function u(path = '/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base + (path.startsWith('/') ? path : `/${path}`);
}

/** A path on the Hub: same origin in production, the Hub's port in development. */
export function hubUrl(env: ToolEnv, path: string): string {
  return (env.HUB_ORIGIN ?? '') + path;
}
