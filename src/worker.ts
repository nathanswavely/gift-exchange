import server from '@astrojs/cloudflare/entrypoints/server';
import { purgeRemoved } from './lib/purge';

/**
 * The gift exchange's Worker: the Astro app for every request under swavely.lol/gifts,
 * and a cron trigger (wrangler.jsonc) that removes whoever the Hub has removed
 * (swavely-lol ADR-0003). The Hub cannot call this Tool, so the Tool asks it.
 */
export default {
  fetch: server.fetch,
  async scheduled(_controller: ScheduledController, env: ToolEnv) {
    const { removed } = await purgeRemoved(env);
    console.log(`purge: ${removed} removed since last run`);
  },
};
