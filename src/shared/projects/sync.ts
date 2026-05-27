import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Credentials } from '@/shared/credentials/credentials';
import { useCredentials } from '@/shared/credentials/useCredentials';
import { setSyncedAt, syncMetaKey } from '@/shared/sync/sync-meta';
import { getJiraProjects } from './api';
import { replaceProjects } from './db';
import { projectsKey } from './useProjects';

/**
 * Pull every Jira project, reconcile it into SQLite, and stamp the sync time.
 * Fetch happens first, so a failed request leaves the persisted data untouched.
 * Shared by the "Sync now" mutation and the one-time onboarding sync.
 */
export async function syncProjects(credentials: Credentials): Promise<void> {
    const fetched = await getJiraProjects(credentials);
    await replaceProjects(fetched);
    await setSyncedAt('projectsSyncedAt');
}

/** "Sync now" for projects: runs {@link syncProjects}, then re-reads the cache. */
export function useSyncProjects() {
    const { data: credentials } = useCredentials();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => syncProjects(credentials!),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: projectsKey }),
                queryClient.invalidateQueries({ queryKey: syncMetaKey }),
            ]);
        },
    });
}
