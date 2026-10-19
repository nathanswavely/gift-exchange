/**
 * Development only: make the local D1 as slow as the real one, so a page that waits on
 * twenty queries in a row feels like it does in production. Locally D1 answers in a
 * fraction of a millisecond, which hides exactly the problem worth finding. Set
 * DEV_DB_LATENCY_MS in .dev.vars (production measured about 15ms a round trip); every
 * call that reaches the database waits that long first.
 *
 * A copy of swavely-lol/src/lib/dev-latency.ts.
 */
export function withLatency(db: D1Database, ms: number): D1Database {
  if (!ms) return db;
  const wait = () => new Promise((r) => setTimeout(r, ms));
  const real = new WeakMap<object, D1PreparedStatement>();
  const statement = (s: D1PreparedStatement): D1PreparedStatement => {
    const p = new Proxy(s, {
      get(target, prop) {
        const v = Reflect.get(target, prop, target);
        if (typeof v !== 'function') return v;
        if (prop === 'bind') return (...args: unknown[]) => statement(v.apply(target, args));
        if (prop === 'first' || prop === 'all' || prop === 'run' || prop === 'raw') {
          return async (...args: unknown[]) => { await wait(); return v.apply(target, args); };
        }
        return v.bind(target);
      },
    });
    real.set(p, s);
    return p;
  };
  return new Proxy(db, {
    get(target, prop) {
      const v = Reflect.get(target, prop, target);
      if (typeof v !== 'function') return v;
      if (prop === 'prepare') return (sql: string) => statement(v.call(target, sql));
      if (prop === 'batch') {
        // One round trip for the whole batch, handing D1 its own statements.
        return async (stmts: D1PreparedStatement[]) => { await wait(); return v.call(target, stmts.map((s) => real.get(s) ?? s)); };
      }
      return v.bind(target);
    },
  });
}
