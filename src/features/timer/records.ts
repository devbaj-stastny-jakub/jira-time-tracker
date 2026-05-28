import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';

import { db } from '@/shared/db/client';
import { recordTags, timeRecords } from './schema';

/** A finished time record as the UI consumes it. Always start+end complete. */
export interface TimeRecord {
    id: string;
    projectId: string;
    ticketNumber: string;
    /** UTC ISO-8601. */
    startAt: string;
    /** UTC ISO-8601. */
    endAt: string;
    tagIds: string[];
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
function localDayBoundsUtc(date = new Date()): { startUtc: string; endUtc: string } {
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

/** Delete a record and its tag rows. */
export async function deleteRecord(id: string): Promise<void> {
    // Delete tags explicitly: SQLite FK cascade is only enforced when the
    // foreign_keys pragma is on, which we don't rely on.
    await db.delete(recordTags).where(eq(recordTags.recordId, id));
    await db.delete(timeRecords).where(eq(timeRecords.id, id));
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
        .where(and(gte(timeRecords.startAt, startUtc), lt(timeRecords.startAt, endUtc)))
        .orderBy(desc(timeRecords.startAt));
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
    }));
}

async function insertTags(recordId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    // De-dupe so a repeated tag can't violate the composite primary key.
    const unique = [...new Set(tagIds)];
    await db.insert(recordTags).values(unique.map((tagId) => ({ recordId, tagId })));
}
