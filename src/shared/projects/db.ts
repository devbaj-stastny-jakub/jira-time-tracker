import { notInArray, sql } from 'drizzle-orm';

import { db } from '@/shared/db/client';
import type { Project } from './api';
import { projects } from './schema';

/** All persisted projects, ordered by key for a stable picker order. */
export async function listProjects(): Promise<Project[]> {
    const rows = await db.select().from(projects).orderBy(projects.key);
    return rows.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        avatarUrl: r.avatarUrl ?? undefined,
    }));
}

/**
 * Reconcile the persisted projects with a freshly-fetched list: upsert every
 * fetched row by id, then delete rows whose ids are no longer present remotely.
 *
 * Upsert-then-prune (rather than delete-all-then-insert) keeps the table
 * populated throughout: the sqlite-proxy driver has no transactions, so a crash
 * mid-sync leaves a few stale rows until the next sync rather than an empty
 * table. Callers fetch from the API before calling this, so a network failure
 * never reaches the DB.
 */
export async function replaceProjects(fetched: Project[]): Promise<void> {
    if (fetched.length === 0) {
        await db.delete(projects);
        return;
    }

    await db
        .insert(projects)
        .values(
            fetched.map((p) => ({
                id: p.id,
                key: p.key,
                name: p.name,
                avatarUrl: p.avatarUrl ?? null,
            })),
        )
        .onConflictDoUpdate({
            // Raw column ref: passing the column object makes drizzle emit a
            // table-qualified target (`"projects"."id"`), which SQLite rejects in
            // an ON CONFLICT clause — it wants a bare column name.
            target: sql`id`,
            set: {
                key: sql`excluded.key`,
                name: sql`excluded.name`,
                avatarUrl: sql`excluded.avatar_url`,
            },
        });

    await db.delete(projects).where(
        notInArray(
            projects.id,
            fetched.map((p) => p.id),
        ),
    );
}
