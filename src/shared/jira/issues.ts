import { fetch } from '@tauri-apps/plugin-http';

import { ApiError } from '@/shared/api-error';
import type { Credentials } from '@/shared/credentials/credentials';

/**
 * Resolve a Jira issue key (e.g. `FOO-123`) to its numeric internal ID. Everit's
 * worklog API wants `issueId` (the integer), not the key — so the push module
 * looks the ID up once per record at push time. Returns the ID as a string
 * because everything downstream (Everit's payload conversion, response parsing)
 * treats numeric IDs as strings to avoid silent precision loss.
 *
 * Endpoint: `GET /rest/api/3/issue/{issueIdOrKey}?fields=`. The `fields=` query
 * keeps the response small — we only read `id`.
 */
export async function getJiraIssueId(
    credentials: Credentials,
    issueKey: string,
): Promise<string> {
    const base = credentials.base_url.trim().replace(/\/+$/, '');
    const auth = `Basic ${btoa(`${credentials.email}:${credentials.jira_token}`)}`;
    const url = `${base}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=`;

    const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: auth, Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new ApiError(
            response.status,
            response.status === 404
                ? `Jira issue ${issueKey} not found`
                : `Jira /issue/${issueKey} returned HTTP ${response.status}`,
        );
    }

    const body = (await response.json()) as { id?: string };
    if (!body.id) {
        throw new Error(`Jira /issue/${issueKey} response missing 'id' field`);
    }
    return body.id;
}
