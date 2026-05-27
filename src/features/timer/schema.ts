import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Local time records. Mirrors the SQL migration in `src-tauri/src/lib.rs`
 * (keep the two in sync). Times are UTC ISO-8601 strings; `project_id` and a
 * record's tags are remote reference IDs resolved against the synced cache in
 * the UI. `ticket_number` is the numeric part the user types — the full Jira
 * key is `<project key>-<ticket_number>`, assembled at display time.
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
