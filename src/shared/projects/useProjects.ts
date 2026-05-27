import { useQuery } from '@tanstack/react-query';

import { referenceDataCache } from '@/shared/cache';
import { useCredentials } from '@/shared/credentials/useCredentials';
import { getJiraProjects } from './api';

export const projectsKey = ['jira', 'projects'] as const;

/**
 * The synced Jira projects. Auto-fetches on demand once credentials exist
 * (shared by the settings section and the worklog UI) and caches for a day.
 * Call `query.refetch()` to force an immediate re-sync.
 */
export function useProjects() {
    const { data: credentials } = useCredentials();
    return useQuery({
        queryKey: projectsKey,
        queryFn: () => getJiraProjects(credentials!),
        enabled: !!credentials,
        ...referenceDataCache,
    });
}
