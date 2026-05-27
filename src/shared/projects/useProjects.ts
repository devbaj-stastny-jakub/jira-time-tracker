import { useQuery } from '@tanstack/react-query';

import { listProjects } from './db';

export const projectsKey = ['jira', 'projects'] as const;

/**
 * The persisted Jira projects, read from SQLite. This never hits the network:
 * data is refreshed only by an explicit sync (Settings "Sync now" or the
 * one-time onboarding sync), which invalidates this query. `staleTime: Infinity`
 * keeps it from refetching on its own.
 */
export function useProjects() {
    return useQuery({
        queryKey: projectsKey,
        queryFn: listProjects,
        staleTime: Infinity,
    });
}
