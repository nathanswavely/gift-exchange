import { env as workerEnv } from 'cloudflare:workers';

export function getEnv(): ToolEnv {
  return workerEnv as unknown as ToolEnv;
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
