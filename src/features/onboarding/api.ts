import { fetch } from '@tauri-apps/plugin-http';

import type { Credentials } from './credentials';

/**
 * Everit "Timetracker for Jira Cloud" REST API.
 * Docs: https://docs.everit.biz/timetracker/rest-api
 * - Fixed cloud host (NOT the user's Jira base URL).
 * - Auth via the `X-Everit-API-Key` header (NOT Basic auth).
 * There is no dedicated token-validation endpoint, so we probe `/public/tag`
 * (a parameterless list) and treat any non-auth-failure response as a working
 * token — see `validateTimetracker`.
 */
const TIMETRACKER_BASE_URL = 'https://jttp-cloud.everit.biz/timetracker/api/latest';
const TIMETRACKER_PROBE_PATH = '/public/tag';

export interface ValidationResult {
    ok: boolean;
    status: number;
}

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '');
}

function browserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/**
 * Validate the Jira API token against the Jira Cloud `/myself` endpoint
 * using Basic auth (`email:token`). HTTP 200 => valid.
 */
export async function validateJira(credentials: Credentials): Promise<ValidationResult> {
    const url = `${normalizeBaseUrl(credentials.base_url)}/rest/api/3/myself`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Basic ${btoa(`${credentials.email}:${credentials.jira_token}`)}`,
            Accept: 'application/json',
        },
    });
    return { ok: response.ok, status: response.status };
}

export interface JiraUser {
    accountId: string;
    displayName: string;
    emailAddress?: string;
}

/** Fetch the authenticated Jira user (`/myself`). Throws on non-2xx. */
export async function getJiraCurrentUser(credentials: Credentials): Promise<JiraUser> {
    const url = `${normalizeBaseUrl(credentials.base_url)}/rest/api/3/myself`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Basic ${btoa(`${credentials.email}:${credentials.jira_token}`)}`,
            Accept: 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Jira /myself returned HTTP ${response.status}`);
    }
    const data = (await response.json()) as JiraUser;
    return data;
}

/**
 * Validate the Everit Timetracker API token. The key is sent in the
 * `X-Everit-API-Key` header against the fixed Everit cloud host. Since there is
 * no dedicated validation endpoint, the token is considered valid when the API
 * accepts the key — i.e. the response is not an auth failure (401/403) and not a
 * server error (5xx). A 200/400/404 all confirm the key authenticated.
 */
export async function validateTimetracker(credentials: Credentials): Promise<ValidationResult> {
    const response = await fetch(`${TIMETRACKER_BASE_URL}${TIMETRACKER_PROBE_PATH}`, {
        method: 'GET',
        headers: {
            'X-Everit-API-Key': credentials.timetracker_token,
            'X-Timezone': browserTimezone(),
            Accept: 'application/json',
        },
    });
    const ok =
        response.status !== 401 && response.status !== 403 && response.status < 500;
    return { ok, status: response.status };
}
