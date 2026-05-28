import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

import { db } from '@/shared/db/client';
import { recordTags, timeRecords } from './schema';

/**
 * A finished time record as the UI consumes it. Always start+end complete.
 *
 * Sync state lives on the same row:
 *  - `everitWorklogId` set ⇒ has been pushed at least once.
 *  - `syncedAt` set + `updatedAt > syncedAt` ⇒ edited since the last push (stale).
 *  - `lastSyncError` set ⇒ the most recent push attempt failed; clears on success.
 *
 * Soft-deleted rows (`deletedAt` set) are filtered out of all list queries and
 * carried by the push module instead — see {@link listPendingForDay}.
 */
export interface TimeRecord {
    id: string;
    projectId: string;
    ticketNumber: string;
    /** UTC ISO-8601. */
    startAt: string;
    /** UTC ISO-8601. */
    endAt: string;
    tagIds: string[];
    /** Remote Everit worklog ID; null if never pushed. */
    everitWorklogId: string | null;
    /** UTC ISO-8601 of the last successful push; null if never pushed. */
    syncedAt: string | null;
    /** UTC ISO-8601 — record-row mtime (bumped by every edit). */
    updatedAt: string;
    /** Last push failure message; null when the record is healthy. */
    lastSyncError: string | null;
}

/**
 * The day's most recent record by end time, or null when there are none. Its
 * project seeds the next entry (manual or timer) since consecutive tasks are
 * usually for the same project.
 */
export function latestRecord(records: TimeRecord[]): TimeRecord | null {
    if (records.length === 0) return null;
    return records.reduce((a, b) => (b.endAt > a.endAt ? b : a), records[0]);
}

/** The four sync states a healthy (non-deleted) record can be in. */
export type SyncState = 'never' | 'synced' | 'stale' | 'errored';

/**
 * Visible badge state. Error trumps everything else — if the last push failed,
 * the user needs to see that regardless of whether the row was ever synced.
 */
export function syncStateOf(record: TimeRecord): SyncState {
    if (record.lastSyncError) return 'errored';
    if (!record.everitWorklogId) return 'never';
    if (record.syncedAt && record.updatedAt > record.syncedAt) return 'stale';
    return 'synced';
}

/** Fields needed to create or fully replace a record (both creation paths). */
export interface RecordInput {
    projectId: string;
    ticketNumber: string;
    startAt: string;
    endAt: string;
    tagIds: string[];
}

/**
 * UTC ISO bounds of the given local calendar day, as `[start, end)`. Records are
 * filtered by `start_at`; stored values are also `Date.toISOString()` output, so
 * a lexicographic string comparison is a correct chronological one.
 */
export function localDayBoundsUtc(date = new Date()): { startUtc: string; endUtc: string } {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

// The sqlite-proxy driver has no transaction support, so writes are sequential.
// For a local single-user store this is acceptable; tag rows are deleted before
// re-insert so an edit can't leave stale tags.

/** Insert a new record (+ its tags). Returns the generated id. */
export async function createRecord(input: RecordInput): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(timeRecords).values({
        id,
        projectId: input.projectId,
        ticketNumber: input.ticketNumber,
        startAt: input.startAt,
        endAt: input.endAt,
        createdAt: now,
        updatedAt: now,
    });
    await insertTags(id, input.tagIds);
    return id;
}

/** Overwrite an existing record's fields and tags. */
export async function updateRecord(id: string, input: RecordInput): Promise<void> {
    await db
        .update(timeRecords)
        .set({
            projectId: input.projectId,
            ticketNumber: input.ticketNumber,
            startAt: input.startAt,
            endAt: input.endAt,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(timeRecords.id, id));
    await db.delete(recordTags).where(eq(recordTags.recordId, id));
    await insertTags(id, input.tagIds);
}

/**
 * User-initiated delete. Never-synced rows are removed outright; synced rows
 * are soft-deleted so the next push can tell Everit to drop the worklog. After
 * a successful remote delete the push module calls {@link hardDeleteRecord}.
 */
export async function deleteRecord(id: string): Promise<void> {
    const [row] = await db
        .select({ everitWorklogId: timeRecords.everitWorklogId })
        .from(timeRecords)
        .where(eq(timeRecords.id, id));
    if (!row || row.everitWorklogId === null) {
        await hardDeleteRecord(id);
        return;
    }
    await db
        .update(timeRecords)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(timeRecords.id, id));
}

/** Physical delete used by the push module after the remote DELETE succeeds. */
export async function hardDeleteRecord(id: string): Promise<void> {
    // Delete tags explicitly: SQLite FK cascade is only enforced when the
    // foreign_keys pragma is on, which we don't rely on.
    await db.delete(recordTags).where(eq(recordTags.recordId, id));
    await db.delete(timeRecords).where(eq(timeRecords.id, id));
}

/** Stamp a successful push: set worklog id (if create), bump synced_at, clear error. */
export async function markSynced(id: string, everitWorklogId: string): Promise<void> {
    await db
        .update(timeRecords)
        .set({
            everitWorklogId,
            syncedAt: new Date().toISOString(),
            lastSyncError: null,
        })
        .where(eq(timeRecords.id, id));
}

/** Stamp a failed push: persist the message so the row UI can show it. */
export async function markSyncFailed(id: string, message: string): Promise<void> {
    await db
        .update(timeRecords)
        .set({ lastSyncError: message })
        .where(eq(timeRecords.id, id));
}

/** Records that started during the current local day, newest first. */
export async function listTodayRecords(): Promise<TimeRecord[]> {
    const { startUtc, endUtc } = localDayBoundsUtc();
    return listRecordsBetween(startUtc, endUtc);
}

/** Records whose `start_at` falls in `[startUtc, endUtc)`, newest first. */
export async function listRecordsBetween(
    startUtc: string,
    endUtc: string,
): Promise<TimeRecord[]> {
    const rows = await db
        .select()
        .from(timeRecords)
        .where(
            and(
                gte(timeRecords.startAt, startUtc),
                lt(timeRecords.startAt, endUtc),
                isNull(timeRecords.deletedAt),
            ),
        )
        .orderBy(desc(timeRecords.startAt));
    return hydrate(rows);
}

/** Pending operation classification for a single row. */
export type PendingOp = 'create' | 'update' | 'delete';

/** A record + the push operation it's waiting for. Includes soft-deleted rows. */
export interface PendingRecord {
    record: TimeRecord;
    op: PendingOp;
}

/**
 * Sync condition used by both {@link listPendingForDay} and
 * {@link countPendingForDay}: a row is pending iff it needs one of the three
 * push ops. Deleted-but-never-synced rows never reach here — `deleteRecord`
 * hard-deletes them.
 */
const PENDING_CONDITION = or(
    // create: not yet pushed and not deleted.
    and(isNull(timeRecords.everitWorklogId), isNull(timeRecords.deletedAt)),
    // update: pushed, not deleted, edited after the last push.
    and(
        isNotNull(timeRecords.everitWorklogId),
        isNull(timeRecords.deletedAt),
        sql`${timeRecords.updatedAt} > ${timeRecords.syncedAt}`,
    ),
    // delete: pushed and now soft-deleted.
    and(isNotNull(timeRecords.everitWorklogId), isNotNull(timeRecords.deletedAt)),
);

/**
 * Every row in `[startUtc, endUtc)` that needs to be pushed, with the op type.
 * Soft-deleted rows are included (the push must send their DELETE) even though
 * they don't appear in {@link listRecordsBetween}. A row that's both edited
 * (stale) and deleted classifies as `delete` — the edits never went anywhere.
 */
export async function listPendingForDay(
    startUtc: string,
    endUtc: string,
): Promise<PendingRecord[]> {
    const rows = await db
        .select()
        .from(timeRecords)
        .where(and(gte(timeRecords.startAt, startUtc), lt(timeRecords.startAt, endUtc), PENDING_CONDITION))
        .orderBy(timeRecords.startAt);
    const ops = new Map(rows.map((r) => [r.id, classifyRaw(r)] as const));
    const hydrated = await hydrate(rows);
    // Non-null assertion: we built `ops` from the same `rows` we hydrated.
    return hydrated.map((record) => ({ record, op: ops.get(record.id)! }));
}

/**
 * Soft-deleted rows in `[startUtc, endUtc)` that still need a remote DELETE.
 * These rows are hidden from {@link listRecordsBetween}, so the calendar uses
 * this to factor pending deletes into its per-day sync rollup.
 */
export interface PendingDeleteSummary {
    id: string;
    startAt: string;
    lastSyncError: string | null;
}

export async function listPendingDeletesInRange(
    startUtc: string,
    endUtc: string,
): Promise<PendingDeleteSummary[]> {
    return db
        .select({
            id: timeRecords.id,
            startAt: timeRecords.startAt,
            lastSyncError: timeRecords.lastSyncError,
        })
        .from(timeRecords)
        .where(
            and(
                gte(timeRecords.startAt, startUtc),
                lt(timeRecords.startAt, endUtc),
                isNotNull(timeRecords.deletedAt),
                isNotNull(timeRecords.everitWorklogId),
            ),
        );
}

/** Count of pending push ops in `[startUtc, endUtc)`. Cheap — used by the UI badge. */
export async function countPendingForDay(startUtc: string, endUtc: string): Promise<number> {
    const [row] = await db
        .select({ n: count() })
        .from(timeRecords)
        .where(and(gte(timeRecords.startAt, startUtc), lt(timeRecords.startAt, endUtc), PENDING_CONDITION));
    return row?.n ?? 0;
}

/**
 * Op type from the raw row — `deleted_at` takes precedence over edits so a
 * delete-after-edit becomes a remote DELETE, not a stale UPDATE.
 */
function classifyRaw(row: typeof timeRecords.$inferSelect): PendingOp {
    if (row.deletedAt) return 'delete';
    if (!row.everitWorklogId) return 'create';
    return 'update';
}

async function hydrate(
    rows: (typeof timeRecords.$inferSelect)[],
): Promise<TimeRecord[]> {
    if (rows.length === 0) return [];

    const tags = await db
        .select()
        .from(recordTags)
        .where(
            inArray(
                recordTags.recordId,
                rows.map((r) => r.id),
            ),
        );
    const tagsByRecord = new Map<string, string[]>();
    for (const { recordId, tagId } of tags) {
        const list = tagsByRecord.get(recordId) ?? [];
        list.push(tagId);
        tagsByRecord.set(recordId, list);
    }

    return rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        ticketNumber: r.ticketNumber,
        startAt: r.startAt,
        endAt: r.endAt,
        tagIds: tagsByRecord.get(r.id) ?? [],
        everitWorklogId: r.everitWorklogId,
        syncedAt: r.syncedAt,
        updatedAt: r.updatedAt,
        lastSyncError: r.lastSyncError,
    }));
}

async function insertTags(recordId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    // De-dupe so a repeated tag can't violate the composite primary key.
    const unique = [...new Set(tagIds)];
    await db.insert(recordTags).values(unique.map((tagId) => ({ recordId, tagId })));
}
