import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Synced Everit Timetracker tags. Mirrors migration v2 in `src-tauri/src/lib.rs`
 * (keep the two in sync). Rows are display-only reference data: a manual sync
 * reconciles them with Everit, and records reference these ids via `record_tags`.
 */
export const tags = sqliteTable('tags', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
});

export type TagRow = typeof tags.$inferSelect;
