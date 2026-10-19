import type { APIRoute } from 'astro';
import { getEnv, u } from '../../../lib/env';
import { getExchange, identities, participantsOf, peopleMap, reveal } from '../../../lib/data';

/**
 * A Giver draws their name (ADR-0003). POST only, from the Stocking component, for the
 * Viewer themselves or someone they manage. With JavaScript the page asks for JSON and
 * plays the stocking; without it, the form posts here and comes back to the page with
 * `?revealed=<giver>` so the label rises on load instead.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = getEnv();
  const viewer = locals.viewer;
  const form = await request.formData();
  const giver = String(form.get('giver') ?? '');
  const back = String(form.get('back') ?? '');
  const ex = await getExchange(env.DB, params.id!);

  const allowed = !!ex && ex.drawnAt !== null && identities(viewer).includes(giver) && (await participantsOf(env.DB, ex.id)).includes(giver);
  const recipientId = allowed ? await reveal(env.DB, ex!.id, giver) : null;

  if (request.headers.get('Accept')?.includes('application/json')) {
    if (!recipientId) return Response.json({ error: 'There is no name waiting for you here.' }, { status: 404 });
    const name = (await peopleMap(env, [recipientId])).get(recipientId)!.name;
    return Response.json({ name, listHref: u(`/list/${recipientId}`) });
  }
  const to = back.startsWith(u('/')) && !back.startsWith('//') ? back : u(`/exchange/${params.id}`);
  const sep = to.includes('?') ? '&' : '?';
  return new Response(null, { status: 303, headers: { Location: recipientId ? `${to}${sep}revealed=${encodeURIComponent(giver)}` : to } });
};

export const GET: APIRoute = ({ params }) => new Response(null, { status: 303, headers: { Location: u(`/exchange/${params.id}`) } });
