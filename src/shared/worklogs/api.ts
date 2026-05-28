import { fetch } from '@tauri-apps/plugin-http';

import { ApiError } from '@/shared/api-error';
import type { Credentials } from '@/shared/credentials/credentials';

/**
 * Everit "Timetracker for Jira Cloud" worklog endpoints — fixed cloud host (NOT
 * the user's Jira base URL), authenticated via `x-everit-api-key`.
 *
 * Spec (docs.everit.biz/timetracker/worklog-api):
 *   POST   /public/worklog           — create
 *   PATCH  /public/worklog           — update (body identifies the worklog)
 *   DELETE /public/worklog?worklogId — delete
 *
 * Two response shapes to watch:
 *  - HTTP-level errors (4xx/5xx) → thrown as {@link ApiError}.
 *  - 200 with a body envelope `{ error: { result, ... }, worklog?: ... }` on
 *    PATCH/DELETE — Everit signals "worklog not found" etc. this way. We
 *    surface those as regular Errors (the message is the `result` code).
 */
const TIMETRACKER_BASE_URL = 'https://jttp-cloud.everit.biz/timetracker/api/latest';
const WORKLOG_PATH = '/public/worklog';

/**
 * Payload the push module hands us — already normalized into Everit's vocabulary
 * so this module only does HTTP. `issueId` is the Jira *numeric* ID (string-form
 * to avoid silent precision loss; we parse to number for the wire). Tag IDs are
 * Everit's numeric tag IDs, also stringified through our local cache.
 */
export interface WorklogPayload {
    issueId: string;
    /** Local date `yyyy-MM-dd`. */
    workDate: string;
    /** Local time `HH:mm`. */
    workStartTime: string;
    /** Duration in whole seconds (Everit's only accepted unit). */
    durationInSeconds: number;
    /** IANA timezone for the `x-timezone` header. The date/time above is in this zone. */
    timezone: string;
    /** Empty string is accepted — we never send a comment in v1. */
    description: string;
    /** Everit tag IDs. */
    worklogTagIds: string[];
}

function authHeaders(credentials: Credentials, timezone: string): Record<string, string> {
    return {
        'x-everit-api-key': credentials.timetracker_token,
        // CSRF token. The docs allow an empty value but require the header to be set.
        'x-requested-by': 'cz.jira.timetracker',
        'x-timezone': timezone,
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };
}

function toWireBody(payload: WorklogPayload) {
    return {
        workDate: payload.workDate,
        workStartTime: payload.workStartTime,
        durationInSeconds: payload.durationInSeconds,
        description: payload.description,
        issueId: Number(payload.issueId),
        worklogTagIds: payload.worklogTagIds.map((id) => Number(id)),
    };
}

/**
 * POST a new worklog. Returns the Everit `worklogId` (as a string) which the
 * caller persists on the local row.
 */
export async function createWorklog(
    credentials: Credentials,
    payload: WorklogPayload,
): Promise<string> {
    const response = await fetch(`${TIMETRACKER_BASE_URL}${WORKLOG_PATH}`, {
        method: 'POST',
        headers: authHeaders(credentials, payload.timezone),
        body: JSON.stringify(toWireBody(payload)),
    });
    if (!response.ok) {
        throw new ApiError(
            response.status,
            `Timetracker POST ${WORKLOG_PATH} returned HTTP ${response.status}`,
        );
    }
    const body = (await response.json()) as { worklogId?: number | string };
    if (body.worklogId === undefined || body.worklogId === null) {
        throw new Error(`Timetracker POST ${WORKLOG_PATH} response missing 'worklogId'`);
    }
    return String(body.worklogId);
}

/**
 * PATCH an existing worklog. The whole payload is sent under `partialWorklog`;
 * we always send all fields so a PATCH is effectively a PUT.
 */
export async function updateWorklog(
    credentials: Credentials,
    worklogId: string,
    payload: WorklogPayload,
): Promise<void> {
    const response = await fetch(`${TIMETRACKER_BASE_URL}${WORKLOG_PATH}`, {
        method: 'PATCH',
        headers: authHeaders(credentials, payload.timezone),
        body: JSON.stringify({
            worklogId: Number(worklogId),
            partialWorklog: toWireBody(payload),
        }),
    });
    if (!response.ok) {
        throw new ApiError(
            response.status,
            `Timetracker PATCH ${WORKLOG_PATH} returned HTTP ${response.status}`,
        );
    }
    const body = (await response.json()) as { error?: { result?: string } | null };
    if (body.error) {
        throw new Error(`Timetracker rejected update: ${body.error.result ?? 'unknown'}`);
    }
}

/**
 * DELETE a worklog. A `WORKLOG_NOT_FOUND` reply is treated as success — the
 * outcome (no remote worklog) is what we wanted.
 */
export async function deleteWorklog(
    credentials: Credentials,
    worklogId: string,
    timezone: string,
): Promise<void> {
    const url = `${TIMETRACKER_BASE_URL}${WORKLOG_PATH}?worklogId=${encodeURIComponent(worklogId)}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: authHeaders(credentials, timezone),
    });
    if (!response.ok) {
        throw new ApiError(
            response.status,
            `Timetracker DELETE ${WORKLOG_PATH} returned HTTP ${response.status}`,
        );
    }
    const body = (await response.json()) as { error?: { result?: string } | null };
    if (body.error && body.error.result !== 'WORKLOG_NOT_FOUND') {
        throw new Error(`Timetracker rejected delete: ${body.error.result ?? 'unknown'}`);
    }
}
