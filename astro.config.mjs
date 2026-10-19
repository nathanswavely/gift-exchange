// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// The gift exchange lives at swavely.lol/gifts, beside the Hub (swavely-lol ADR-0001).
// Every page is rendered on request: who is signed in is asked of the Hub each time.
export default defineConfig({
  site: 'https://swavely.lol',
  base: '/gifts',
  trailingSlash: 'ignore',
  output: 'server',
  session: false,
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
});
