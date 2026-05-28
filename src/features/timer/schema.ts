import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Local time records. Mirrors the SQL migration in `src-tauri/src/lib.rs`
 * (keep the two in sync). Times are UTC ISO-8601 strings; `project_id` and a
 * record's tags are remote reference IDs resolved against the synced cache in
 * the UI. `ticket_number` is the numeric part the user types — the full Jira
 * key is `<project key>-<ticket_number>`, assembled at display time.
 *
 * Sync state (added in migration v3) lives on the same row rather than a side
 * table: `everit_worklog_id` is the remote ID after a successful push,
 * `synced_at` is the last successful push instant (`updated_at > synced_at` ⇒
 * stale), `last_sync_error` carries the last failure message, and `deleted_at`
 * soft-deletes a row pending a remote DELETE.
 */
export const timeRecords = sqliteTable(
    'time_records',
    {
        id: text('id').primaryKey(),
        projectId: text('project_id').notNull(),
        ticketNumber: text('ticket_number').notNull(),
        startAt: text('start_at').notNull(),
        endAt: text('end_at').notNull(),
        createdAt: text('created_at').notNull(),
        updatedAt: text('updated_at').notNull(),
        everitWorklogId: text('everit_worklog_id'),
        syncedAt: text('synced_at'),
        lastSyncError: text('last_sync_error'),
        deletedAt: text('deleted_at'),
    },
    (t) => [index('idx_time_records_start_at').on(t.startAt)],
);

/** 0-N tags per record (many-to-many). Tag IDs are remote references. */
export const recordTags = sqliteTable(
    'record_tags',
    {
        recordId: text('record_id')
            .notNull()
            .references(() => timeRecords.id, { onDelete: 'cascade' }),
        tagId: text('tag_id').notNull(),
    },
    (t) => [primaryKey({ columns: [t.recordId, t.tagId] })],
);

export type TimeRecordRow = typeof timeRecords.$inferSelect;
export type RecordTagRow = typeof recordTags.$inferSelect;
