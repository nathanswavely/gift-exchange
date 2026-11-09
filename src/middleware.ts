import { toolGuard } from '@swavely-lol/kit/guard';

/**
 * Who is this: the Hub says (swavely-lol ADR-0001), through the kit's guard. Every page
 * of the gift exchange needs a Person: no session, or one the Hub no longer knows, and
 * it is off to the Hub's sign-in, which sends them back. Every POST must come from this
 * origin, and every response is noindex.
 */
export const onRequest = toolGuard({ needsPerson: () => true });
