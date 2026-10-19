import { defineMiddleware } from 'astro:middleware';
import { getEnv, hubUrl, u } from './lib/env';

/**
 * Who is this: the Hub says (swavely-lol ADR-0001). The browser sends the Hub's
 * host-only session cookie here because this Tool is a path on the same host; the
 * Tool hands its value to HubApi.whoIs and keeps nothing of it. No session, or one the
 * Hub no longer knows: off to the Hub's sign-in, which sends them back.
 *
 * Every POST must come from this origin, and every response is noindex.
 */
const COOKIE = 'lol_session';

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url;
  const env = getEnv();

  if (ctx.request.method !== 'GET' && ctx.request.method !== 'HEAD') {
    const site = ctx.request.headers.get('Sec-Fetch-Site');
    const origin = ctx.request.headers.get('Origin');
    const sameOrigin = site === 'same-origin' || (origin !== null && origin === ctx.url.origin);
    if (!sameOrigin) return new Response('Cross-origin request refused.', { status: 403 });
  }

  const open = pathname === u('/healthz') || pathname.startsWith(u('/_astro/'));
  if (!open) {
    const id = readCookie(ctx.request, COOKIE);
    const viewer = id ? await env.HUB.whoIs(id) : null;
    if (!viewer) return ctx.redirect(hubUrl(env, `/login?next=${encodeURIComponent(pathname + ctx.url.search)}`), 302);
    ctx.locals.viewer = viewer;
  }

  const res = await next();
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (!pathname.startsWith(u('/_astro/'))) res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  return res;
});
