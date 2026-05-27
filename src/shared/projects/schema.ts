import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Synced Jira projects. Mirrors migration v2 in `src-tauri/src/lib.rs` (keep the
 * two in sync). Rows are display-only reference data: a manual sync reconciles
 * them with Jira, and records store `project_id` referencing this `id`.
 */
export const projects = sqliteTable('projects', {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
});

export type ProjectRow = typeof projects.$inferSelect;
