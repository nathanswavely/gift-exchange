/**
 * Removing a Person removes them from the gift exchange (swavely-lol ADR-0003), end to
 * end against the seed family. Run with `npm run test:removal`.
 *
 * Builds the Hub (../swavely-lol) and this Tool, then runs both with `wrangler dev` on
 * their own ports, their own state under .wrangler/test-removal and their own dev
 * registry, so a dev server already running for either is never touched. Signs in by
 * writing session rows straight into that state. Exits non-zero on the first broken
 * promise, and always stops what it started.
 */
import { spawn, spawnSync } from 'node:child_process';
import { request } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HUB = resolve(TOOL, '../swavely-lol');
// Short on purpose: workerd's SQLite fails on Windows under a long path. One each: two
// workerd processes on one state directory lock each other out.
const STATE = resolve(TOOL, '.wrangler/test-removal');
const stateOf = (cwd) => resolve(STATE, cwd === HUB ? 'hub' : 'tool');
const REGISTRY = resolve(TOOL, '.wrangler/test-removal-registry');
const HUB_PORT = Number(process.env.HUB_PORT ?? 4361);
const TOOL_PORT = Number(process.env.TOOL_PORT ?? 4362);
const hubAt = `http://127.0.0.1:${HUB_PORT}`;
const toolAt = `http://127.0.0.1:${TOOL_PORT}/gifts`;
const env = { ...process.env, WRANGLER_REGISTRY_PATH: REGISTRY, NO_COLOR: '1' };

let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; console.error('FAIL', what); } else console.log('ok  ', what); };

function run(cwd, args) {
  const r = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${args.slice(1).join(' ')} in ${cwd}:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
const wrangler = (cwd, ...args) => run(cwd, [resolve(cwd, 'node_modules/wrangler/bin/wrangler.js'), ...args]);
const sqlFile = (cwd, db, file) => wrangler(cwd, 'd1', 'execute', db, '--local', '--persist-to', stateOf(cwd), '--file', file);
/** Rows of the last statement in `command`. */
function sql(cwd, db, command) {
  const out = JSON.parse(wrangler(cwd, 'd1', 'execute', db, '--local', '--persist-to', stateOf(cwd), '--json', '--command', command));
  return out[out.length - 1].results;
}
const hubSql = (q) => sql(HUB, 'swavely-lol', q);
const toolSql = (q) => sql(TOOL, 'gift-exchange', q);

// ------------------------------------------------------------- servers ----

const servers = [];
function start(cwd, port, extra = []) {
  const child = spawn(
    process.execPath,
    [resolve(cwd, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '-c', 'dist/server/wrangler.json', '--persist-to', stateOf(cwd), '--port', String(port), '--inspector-port', String(port + 5000), '--show-interactive-dev-session=false', ...extra],
    { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' },
  );
  const s = { child, log: '' };
  child.stdout.on('data', (d) => (s.log += d));
  child.stderr.on('data', (d) => (s.log += d));
  servers.push(s);
  return s;
}
function stopAll() {
  for (const { child } of servers) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    else try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  }
}
/**
 * One request on a connection of its own. fetch() reuses keep-alive connections, and
 * workerd closes idle ones, which shows up as a stray ECONNRESET.
 */
function http(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((done, fail) => {
    const req = request(url, { method, headers, agent: false }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (text += d));
      res.on('end', () => done({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, location: res.headers.location ?? '', text }));
    });
    req.on('error', fail);
    req.end(body);
  });
}
async function up(url) {
  for (let i = 0; i < 60; i++) {
    try { if ((await http(url)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${url} never came up`);
}
async function free(port) {
  try { await http(`http://127.0.0.1:${port}/`); return false; } catch { return true; }
}

// ------------------------------------------------------------- helpers ----

const cookieOf = {};
function session(personId) {
  const id = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(id).digest('hex');
  hubSql(`INSERT INTO sessions (id_hash, person_id, created_at, expires_at, last_seen_at, user_agent) VALUES ('${hash}', '${personId}', 0, 4102444800, 0, 'test-removal')`);
  cookieOf[personId] = `lol_session=${id}`;
}
const get = (url, as) => http(url, { headers: { Cookie: cookieOf[as] } });
const post = (url, as, form) =>
  http(url, { method: 'POST', headers: { Cookie: cookieOf[as], 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });
async function tick() {
  const r = await http(`http://127.0.0.1:${TOOL_PORT}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent('17 * * * *')}`);
  check(r.ok, `the hourly purge runs (${r.status})`);
}
const pairings = (ex) => new Map(toolSql(`SELECT giver_id, recipient_id FROM pairings WHERE exchange_id = '${ex}'`).map((r) => [r.giver_id, r.recipient_id]));
const participants = (ex) => toolSql(`SELECT person_id FROM participants WHERE exchange_id = '${ex}'`).map((r) => r.person_id).sort();
/** Every row in the Tool that still names this Person, table by table. */
function traces(id) {
  const [r] = toolSql(`SELECT
    (SELECT count(*) FROM group_people WHERE person_id = '${id}') AS group_people,
    (SELECT count(*) FROM exclusions WHERE '${id}' IN (giver_id, recipient_id)) AS exclusions,
    (SELECT count(*) FROM participants WHERE person_id = '${id}') AS participants,
    (SELECT count(*) FROM fixed_pairings WHERE '${id}' IN (giver_id, recipient_id)) AS fixed_pairings,
    (SELECT count(*) FROM pairings WHERE '${id}' IN (giver_id, recipient_id)) AS pairings,
    (SELECT count(*) FROM items WHERE person_id = '${id}') AS items,
    (SELECT count(*) FROM claims WHERE claimer_id = '${id}' OR item_id NOT IN (SELECT id FROM items)) AS claims`);
  return Object.entries(r).filter(([, n]) => n > 0).map(([t, n]) => `${t}: ${n}`);
}
/** A whole draw: everyone gives once and receives once, never themselves, never against an Exclusion. */
function valid(pairs, people, group) {
  const excluded = new Set(toolSql(`SELECT giver_id || '>' || recipient_id AS e FROM exclusions WHERE group_id = '${group}'`).map((r) => r.e));
  return pairs.size === people.length && [...pairs.keys()].sort().join() === people.join() && [...pairs.values()].sort().join() === people.join()
    && [...pairs].every(([g, r]) => g !== r && !excluded.has(`${g}>${r}`));
}

// ---------------------------------------------------------------- setup ----

async function main() {
  if (!(await free(HUB_PORT)) || !(await free(TOOL_PORT))) throw new Error(`port ${HUB_PORT} or ${TOOL_PORT} is in use; set HUB_PORT and TOOL_PORT`);
  console.log('building the Hub and the Tool');
  for (const cwd of [HUB, TOOL]) run(cwd, [resolve(cwd, 'node_modules/astro/bin/astro.mjs'), 'build']);
  rmSync(STATE, { recursive: true, force: true });
  rmSync(REGISTRY, { recursive: true, force: true });
  wrangler(HUB, 'd1', 'migrations', 'apply', 'swavely-lol', '--local', '--persist-to', stateOf(HUB));
  sqlFile(HUB, 'swavely-lol', 'scripts/dev-seed.sql');
  wrangler(TOOL, 'd1', 'migrations', 'apply', 'gift-exchange', '--local', '--persist-to', stateOf(TOOL));
  sqlFile(TOOL, 'gift-exchange', 'scripts/dev-seed.sql');
  sqlFile(TOOL, 'gift-exchange', 'scripts/test-removal.sql');
  session('p_homer'); // the Hub Admin, and an Organizer of both Groups
  session('p_patty');

  start(HUB, HUB_PORT);
  const tool = start(TOOL, TOOL_PORT, ['--test-scheduled']);
  await up(`${hubAt}/healthz`);
  await up(`${toolAt}/healthz`);

  // ---------------------------------------- Lisa: a drawn Exchange re-pairs ----
  const drew = await post(`${toolAt}/exchange/x_draw`, 'p_homer', { action: 'draw' });
  check(drew.status === 303 && /done=draw/.test(drew.location), 'Homer draws the 2098 Exchange');
  const before = pairings('x_draw');
  const lisasGiver = [...before].find(([, r]) => r === 'p_lisa')?.[0];

  const removed = await post(`${hubAt}/people`, 'p_homer', { action: 'remove', id: 'p_lisa' });
  check(removed.status === 200 && removed.text.includes('Removed.'), 'Homer removes Lisa on the People page');
  check(hubSql(`SELECT 1 FROM people WHERE id = 'p_lisa'`).length === 0, 'the Hub forgets Lisa');
  check(hubSql(`SELECT 1 FROM removed_people WHERE id = 'p_lisa'`).length === 1, "the Hub keeps Lisa's bare id on its removed list");
  check(traces('p_lisa').length > 0, 'until the purge runs, the Tool still holds her');

  await tick();
  check(traces('p_lisa').length === 0, `no row in the Tool names Lisa (${traces('p_lisa').join(', ') || 'none'})`);
  const after = pairings('x_draw');
  const seven = participants('x_draw');
  check(seven.length === 7, 'the drawn Exchange goes on without her');
  check(valid(after, seven, 'g_simpsons'), 'its Re-pairing is a whole, lawful draw');
  const changed = seven.filter((g) => before.get(g) !== after.get(g));
  check(changed.includes(lisasGiver), "Lisa's Giver has a new name");
  check(changed.length <= 2, `only the Givers who must change do (${changed.length})`);
  check(pairings('x_2025').size === 6, "last year's history keeps everyone else's Pairings");
  check(participants('x_open').length === 7, 'the open Exchange drops her as a Participant');
  check(toolSql(`SELECT id FROM items WHERE id IN ('i_4', 'i_5')`).length === 0, 'her Wish list is gone, and the Claim on it');
  check(toolSql(`SELECT value FROM hub_cursor WHERE name = 'removed'`).length === 1, 'the Tool remembers how far it has read');

  // ------------------------------- Abe: no lawful Re-pairing, so it waits ----
  await post(`${hubAt}/people`, 'p_homer', { action: 'remove', id: 'p_abe' });
  await tick();
  check(traces('p_abe').length === 0, `no row in the Tool names Abe (${traces('p_abe').join(', ') || 'none'})`);
  const tight = pairings('x_tnow');
  check(tight.size === 1 && tight.get('p_selma') === 'p_patty', 'the tight Exchange keeps the Pairing that did not involve him and drops the rest');
  check(participants('x_tnow').join() === 'p_patty,p_selma', 'and goes on with Patty and Selma');
  const asHomer = (await get(`${toolAt}/exchange/x_tnow`, 'p_homer')).text;
  check(asHomer.includes('Re-pair now') && asHomer.includes('One person taking part has'), 'its Organizer is asked to Re-pair');
  const asPatty = (await get(`${toolAt}/exchange/x_tnow`, 'p_patty')).text;
  check(asPatty.includes('a new name is on its way'), 'Patty is told a new name is coming');
  check(valid(pairings('x_draw'), participants('x_draw'), 'g_simpsons') && participants('x_draw').length === 6, 'the Simpson draw re-pairs again without Abe');
  check(toolSql(`SELECT 1 FROM items WHERE id = 'i_abe'`).length === 0, 'his Wish list is gone, with Selma\'s Claim on it');

  // ------------------------------------------------- safe to run twice ----
  const all = () => JSON.stringify(toolSql('SELECT * FROM pairings ORDER BY exchange_id, giver_id'));
  const snapshot = all();
  await tick();
  check(all() === snapshot, 'running the purge again changes nothing');
  check(/purge p_abe/.test(tool.log), 'the Tool logs each purge');
}

try {
  await main();
} catch (e) {
  failures++;
  console.error(e);
} finally {
  if (failures) for (const s of servers) console.error(`\n--- ${s.child.spawnargs.includes(String(HUB_PORT)) ? 'hub' : 'tool'} log ---\n${s.log.slice(-3000)}`);
  stopAll();
}
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('removal: every promise holds');
