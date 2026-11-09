import { getEnv as kitEnv } from '@swavely-lol/kit/env';

/**
 * The Worker env, from the kit (swavely-lol ADR-0004), typed as this Tool's. `u` and
 * `hubUrl` are the kit's, re-exported so pages import from one place.
 */
export { u, hubUrl } from '@swavely-lol/kit/env';
export const getEnv = (): ToolEnv => kitEnv<ToolEnv>();
