import { notInArray, sql } from 'drizzle-orm';

import { db } from '@/shared/db/client';
import type { Tag } from './api';
import { tags } from './schema';

/** All persisted tags, ordered by name for a stable picker order. */
export async function listTags(): Promise<Tag[]> {
    const rows = await db.select().from(tags).orderBy(tags.name);
    return rows.map((r) => ({ id: r.id, name: r.name }));
}

/**
 * Reconcile the persisted tags with a freshly-fetched list: upsert every fetched
 * row by id, then delete rows whose ids are no longer present remotely. See
 * {@link replaceProjects} for why this is upsert-then-prune rather than a full
 * replace.
 */
export async function replaceTags(fetched: Tag[]): Promise<void> {
    if (fetched.length === 0) {
        await db.delete(tags);
        return;
    }

    await db
        .insert(tags)
        .values(fetched.map((t) => ({ id: t.id, name: t.name })))
        .onConflictDoUpdate({
            // Raw column ref: passing the column object makes drizzle emit a
            // table-qualified target (`"tags"."id"`), which SQLite rejects in an
            // ON CONFLICT clause — it wants a bare column name.
            target: sql`id`,
            set: { name: sql`excluded.name` },
        });

    await db.delete(tags).where(
        notInArray(
            tags.id,
            fetched.map((t) => t.id),
        ),
    );
}
