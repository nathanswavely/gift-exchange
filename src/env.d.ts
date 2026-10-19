/// <reference types="astro/client" />

/** Environment the Worker runs with: wrangler.jsonc bindings, and .dev.vars locally. */
interface ToolEnv {
  /** The Hub's HubApi entrypoint, over a service binding. */
  HUB: import('./lib/hub-contract').HubApiContract;
  /** Groups, Exchanges, Pairings, Wish lists. */
  DB: D1Database;
  /** Development only: where the Hub runs (http://localhost:4331). Production: same origin. */
  HUB_ORIGIN?: string;
}

declare namespace App {
  interface Locals {
    /** The signed-in Person, from the Hub; set by src/middleware.ts. */
    viewer: import('./lib/hub-contract').Viewer;
  }
}
