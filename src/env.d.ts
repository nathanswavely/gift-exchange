/// <reference types="astro/client" />

/** Environment the Worker runs with: wrangler.jsonc bindings, and .dev.vars locally. */
interface ToolEnv {
  /** The Hub's HubApi entrypoint, over a service binding. */
  HUB: import('@swavely-lol/kit/contract').HubApiContract;
  /** Development only: milliseconds to add to every database call (the kit's dev-latency). */
  DEV_DB_LATENCY_MS?: string;
  /** Groups, Exchanges, Pairings, Wish lists. */
  DB: D1Database;
  /** Development only: where the Hub runs (http://localhost:4331). Production: same origin. */
  HUB_ORIGIN?: string;
}

declare namespace App {
  interface Locals {
    /** The signed-in Person, from the Hub; set by src/middleware.ts (the kit's toolGuard). */
    viewer: import('@swavely-lol/kit/contract').Viewer;
  }
}
