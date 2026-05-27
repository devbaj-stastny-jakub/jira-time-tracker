import Database from '@tauri-apps/plugin-sql';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

/**
 * Drizzle client over `tauri-plugin-sql`, shared by every feature that touches
 * the local SQLite DB (time records, and the synced projects/tags reference
 * data). Lives in `shared/` so reference-data modules don't have to import from
 * a feature folder.
 *
 * Prisma can't run inside the Tauri webview, so we use Drizzle's `sqlite-proxy`
 * driver: Drizzle builds the SQL (with `?` placeholders, matching SQLite) and we
 * delegate execution to the plugin's `select` / `execute`. `select` returns rows
 * as objects; the proxy expects positional value arrays, so we map each row with
 * `Object.values` — the key order matches the SELECT column order Drizzle emits.
 *
 * Callers pass their own table objects to `db.select()/insert()/…`, so the
 * relational-query `schema` option isn't needed here.
 *
 * Primary keys for records are UUIDs generated in JS (`crypto.randomUUID()`), so
 * we never depend on `lastInsertId` round-tripping through the proxy.
 */
const DB_URL = 'sqlite:timetracker.db';

let sqlitePromise: Promise<Database> | null = null;

function getSqlite(): Promise<Database> {
    sqlitePromise ??= Database.load(DB_URL);
    return sqlitePromise;
}

export const db = drizzle(async (sql, params, method) => {
    const sqlite = await getSqlite();

    // Drizzle's proxy wraps any rejection in a generic "Failed query" message
    // that drops the underlying SQLite error (e.g. "no such table"). Surface the
    // real cause so DB failures are diagnosable from the UI/logs.
    try {
        if (method === 'run') {
            await sqlite.execute(sql, params);
            return { rows: [] };
        }

        const result = await sqlite.select<Record<string, unknown>[]>(sql, params);
        const rows = result.map((row) => Object.values(row));
        return { rows: method === 'get' ? (rows[0] ?? []) : rows };
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`SQLite ${method} failed: ${message}`, { cause });
    }
});
