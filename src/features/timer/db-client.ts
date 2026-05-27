import Database from '@tauri-apps/plugin-sql';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import * as schema from './schema';

/**
 * Drizzle client over `tauri-plugin-sql`.
 *
 * Prisma can't run inside the Tauri webview, so we use Drizzle's `sqlite-proxy`
 * driver: Drizzle builds the SQL (with `?` placeholders, matching SQLite) and we
 * delegate execution to the plugin's `select` / `execute`. `select` returns rows
 * as objects; the proxy expects positional value arrays, so we map each row with
 * `Object.values` — the key order matches the SELECT column order Drizzle emits.
 *
 * Primary keys are UUIDs generated in JS (`crypto.randomUUID()`), so we never
 * depend on `lastInsertId` round-tripping through the proxy.
 */
const DB_URL = 'sqlite:timetracker.db';

let sqlitePromise: Promise<Database> | null = null;

function getSqlite(): Promise<Database> {
    sqlitePromise ??= Database.load(DB_URL);
    return sqlitePromise;
}

export const db = drizzle(
    async (sql, params, method) => {
        const sqlite = await getSqlite();

        if (method === 'run') {
            await sqlite.execute(sql, params);
            return { rows: [] };
        }

        const result = await sqlite.select<Record<string, unknown>[]>(sql, params);
        const rows = result.map((row) => Object.values(row));
        return { rows: method === 'get' ? (rows[0] ?? []) : rows };
    },
    { schema },
);
