import { fetch } from '@tauri-apps/plugin-http';

import { ApiError } from '@/shared/api-error';
import type { Credentials } from '@/shared/credentials/credentials';

/** Normalized Jira project — the minimal shape the app consumes. */
export interface Project {
    id: string;
    key: string;
    name: string;
    avatarUrl?: string;
}

/** One page of Jira's paginated `/project/search` response. */
interface ProjectSearchPage {
    values: Array<{
        id: string;
        key: string;
        name: string;
        avatarUrls?: Record<string, string>;
    }>;
    isLast: boolean;
}

const PAGE_SIZE = 100;

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '');
}

/**
 * Fetch every Jira project via `GET /rest/api/3/project/search`, paging until
 * `isLast`. Returns one flat, normalized list. Throws {@link ApiError} on the
 * first non-2xx response — a partial result is never returned.
 */
export async function getJiraProjects(credentials: Credentials): Promise<Project[]> {
    const base = normalizeBaseUrl(credentials.base_url);
    const auth = `Basic ${btoa(`${credentials.email}:${credentials.jira_token}`)}`;

    const projects: Project[] = [];
    let startAt = 0;

    for (;;) {
        const url = `${base}/rest/api/3/project/search?startAt=${startAt}&maxResults=${PAGE_SIZE}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: auth, Accept: 'application/json' },
        });
        if (!response.ok) {
            throw new ApiError(
                response.status,
                `Jira /project/search returned HTTP ${response.status}`,
            );
        }

        const page = (await response.json()) as ProjectSearchPage;
        for (const p of page.values) {
            projects.push({
                id: p.id,
                key: p.key,
                name: p.name,
                avatarUrl: p.avatarUrls?.['48x48'],
            });
        }

        if (page.isLast || page.values.length === 0) break;
        startAt += page.values.length;
    }

    return projects;
}
