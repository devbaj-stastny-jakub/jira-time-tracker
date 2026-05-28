import type { Credentials } from '@/shared/credentials/credentials';
import { getJiraIssueId } from '@/shared/jira/issues';
import { listProjects } from '@/shared/projects/db';
import {
    createWorklog,
    deleteWorklog,
    updateWorklog,
    type WorklogPayload,
} from '@/shared/worklogs/api';
import { ticketKey } from './format';
import {
    hardDeleteRecord,
    listPendingForDay,
    markSyncFailed,
    markSynced,
    type PendingOp,
    type PendingRecord,
    type TimeRecord,
} from './records';

/** Result of a bulk push — counts only; per-row state lives on the rows themselves. */
export interface PushSummary {
    succeeded: number;
    failed: number;
}

function browserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Everit's wire format wants the user's *local* date and time, paired with the
 * `x-timezone` header. We derive both from the record's UTC instant so the
 * worklog lands on the same calendar day the user saw it on locally.
 */
function localDateAndTime(iso: string): { workDate: string; workStartTime: string } {
    const d = new Date(iso);
    return {
        workDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        workStartTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
}

function durationSeconds(record: TimeRecord): number {
    return Math.round(
        (new Date(record.endAt).getTime() - new Date(record.startAt).getTime()) / 1000,
    );
}

/**
 * Built once per push (bulk or single) so we don't re-read the projects table
 * per record. The project map resolves `record.projectId` (Jira project ID) to
 * its key (e.g. `FOO`), which we combine with `ticketNumber` to form the issue
 * key Everit needs an `issueId` for.
 */
interface SyncContext {
    credentials: Credentials;
    projectKeys: Map<string, string>;
}

async function buildContext(credentials: Credentials): Promise<SyncContext> {
    const projects = await listProjects();
    const projectKeys = new Map(projects.map((p) => [p.id, p.key]));
    return { credentials, projectKeys };
}

async function buildPayload(
    ctx: SyncContext,
    record: TimeRecord,
): Promise<WorklogPayload> {
    const projectKey = ctx.projectKeys.get(record.projectId);
    if (!projectKey) {
        throw new Error(
            `Project ${record.projectId} isn't in the local cache — run "Sync now" in Settings`,
        );
    }
    const issueKey = ticketKey(projectKey, record.ticketNumber);
    const issueId = await getJiraIssueId(ctx.credentials, issueKey);
    const { workDate, workStartTime } = localDateAndTime(record.startAt);
    return {
        issueId,
        workDate,
        workStartTime,
        durationInSeconds: durationSeconds(record),
        timezone: browserTimezone(),
        description: '',
        worklogTagIds: record.tagIds,
    };
}

/**
 * Push one pending record. Per-record success commits its own local state
 * (worklog id + syncedAt for create/update; hard-delete after a remote delete).
 * Failure is the caller's responsibility to stamp.
 */
async function pushOne(ctx: SyncContext, pending: PendingRecord): Promise<void> {
    const { record, op } = pending;

    if (op === 'delete') {
        if (!record.everitWorklogId) {
            // PENDING_CONDITION guarantees this never happens; loud throw for the
            // case a schema-level invariant breaks rather than silently no-op-ing.
            throw new Error(`Record ${record.id} pending delete without an Everit worklog ID`);
        }
        await deleteWorklog(ctx.credentials, record.everitWorklogId, browserTimezone());
        await hardDeleteRecord(record.id);
        return;
    }

    const payload = await buildPayload(ctx, record);

    if (op === 'create') {
        const worklogId = await createWorklog(ctx.credentials, payload);
        await markSynced(record.id, worklogId);
        return;
    }

    // op === 'update'
    if (!record.everitWorklogId) {
        throw new Error(`Record ${record.id} pending update without an Everit worklog ID`);
    }
    await updateWorklog(ctx.credentials, record.everitWorklogId, payload);
    await markSynced(record.id, record.everitWorklogId);
}

/**
 * Push every pending record in `[startUtc, endUtc)`, sequentially. All errors —
 * including 401/403 and network failures — are treated as per-record failures:
 * the loop continues and stamps `last_sync_error` on the row. Final summary
 * counts go back to the caller for a toast.
 */
export async function pushDay(
    credentials: Credentials,
    startUtc: string,
    endUtc: string,
): Promise<PushSummary> {
    const pending = await listPendingForDay(startUtc, endUtc);
    if (pending.length === 0) return { succeeded: 0, failed: 0 };

    const ctx = await buildContext(credentials);
    let succeeded = 0;
    let failed = 0;
    for (const item of pending) {
        try {
            await pushOne(ctx, item);
            succeeded++;
        } catch (cause) {
            failed++;
            const message = cause instanceof Error ? cause.message : String(cause);
            // Best-effort: if even the error stamp fails we still continue the
            // loop — the React Query mutation result will carry the count.
            await markSyncFailed(item.record.id, message).catch(() => {});
        }
    }
    return { succeeded, failed };
}

/**
 * Push a single visible record from the per-row "Sync now" menu. Soft-deleted
 * rows aren't reachable from this entry point — they only flow through
 * {@link pushDay}.
 *
 * Throws on failure (so the per-row mutation can surface it), but also stamps
 * `last_sync_error` on the row so the badge updates even before the caller
 * shows a toast.
 */
export async function pushRecord(credentials: Credentials, record: TimeRecord): Promise<void> {
    const op: PendingOp = record.everitWorklogId ? 'update' : 'create';

    // If somehow called on an already-in-sync row (e.g. user clicks Sync after a
    // previous attempt finally landed): clear the stale error and bail. There's
    // nothing to push.
    if (op === 'update' && record.syncedAt && record.updatedAt <= record.syncedAt) {
        if (record.lastSyncError) {
            await markSynced(record.id, record.everitWorklogId!);
        }
        return;
    }

    const ctx = await buildContext(credentials);
    try {
        await pushOne(ctx, { record, op });
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        await markSyncFailed(record.id, message).catch(() => {});
        throw cause;
    }
}
