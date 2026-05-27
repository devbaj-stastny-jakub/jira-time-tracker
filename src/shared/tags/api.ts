import { fetch } from '@tauri-apps/plugin-http';

import { ApiError } from '@/shared/api-error';
import type { Credentials } from '@/shared/credentials/credentials';

/**
 * Everit "Timetracker for Jira Cloud" REST API — fixed cloud host (NOT the
 * user's Jira base URL), authenticated via the `X-Everit-API-Key` header.
 * Tags are global (the `/public/tag` list takes no project parameter).
 * Docs: https://docs.everit.biz/timetracker/rest-api
 */
const TIMETRACKER_BASE_URL = 'https://jttp-cloud.everit.biz/timetracker/api/latest';
const TAG_PATH = '/public/tag';

/** Normalized Timetracker tag — the minimal shape the app consumes. */
export interface Tag {
    id: string;
    name: string;
}

/**
 * Raw `/public/tag` item. Field names are tolerated defensively until confirmed
 * against the live response (see Q10 in the design discussion).
 */
interface RawTag {
    id?: string | number;
    tagId?: string | number;
    name?: string;
    tagName?: string;
}

function browserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/**
 * Fetch the global Timetracker tags via `GET /public/tag`. Returns a flat,
 * normalized list. Throws {@link ApiError} on a non-2xx response.
 */
export async function getTimetrackerTags(credentials: Credentials): Promise<Tag[]> {
    const response = await fetch(`${TIMETRACKER_BASE_URL}${TAG_PATH}`, {
        method: 'GET',
        headers: {
            'X-Everit-API-Key': credentials.timetracker_token,
            'X-Timezone': browserTimezone(),
            Accept: 'application/json',
        },
    });
    if (!response.ok) {
        throw new ApiError(
            response.status,
            `Timetracker ${TAG_PATH} returned HTTP ${response.status}`,
        );
    }

    const data = (await response.json()) as unknown;
    const raw = extractTagArray(data);
    return raw.map((t) => ({
        id: String(t.id ?? t.tagId),
        name: t.name ?? t.tagName ?? '',
    }));
}

/**
 * The tag list may come back as a bare array or wrapped in an object
 * (`{ tags }`, `{ values }`, …). Pull out the array; throw a message that names
 * the actual shape when none is found, so failures are diagnosable.
 */
function extractTagArray(data: unknown): RawTag[] {
    if (Array.isArray(data)) return data as RawTag[];
    if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        for (const key of ['worklogTags', 'tags', 'values', 'results', 'content', 'data']) {
            if (Array.isArray(obj[key])) return obj[key] as RawTag[];
        }
        throw new Error(
            `Unexpected /public/tag response shape: object with keys [${Object.keys(obj).join(', ')}]`,
        );
    }
    throw new Error(`Unexpected /public/tag response shape: ${typeof data}`);
}
