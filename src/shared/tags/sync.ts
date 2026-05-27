import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Credentials } from '@/shared/credentials/credentials';
import { useCredentials } from '@/shared/credentials/useCredentials';
import { setSyncedAt, syncMetaKey } from '@/shared/sync/sync-meta';
import { getTimetrackerTags } from './api';
import { replaceTags } from './db';
import { tagsKey } from './useTags';

/**
 * Pull the global Everit tags, reconcile them into SQLite, and stamp the sync
 * time. Fetch happens first, so a failed request leaves the persisted data
 * untouched. Shared by the "Sync now" mutation and the one-time onboarding sync.
 */
export async function syncTags(credentials: Credentials): Promise<void> {
    const fetched = await getTimetrackerTags(credentials);
    await replaceTags(fetched);
    await setSyncedAt('tagsSyncedAt');
}

/** "Sync now" for tags: runs {@link syncTags}, then re-reads the cache. */
export function useSyncTags() {
    const { data: credentials } = useCredentials();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => syncTags(credentials!),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: tagsKey }),
                queryClient.invalidateQueries({ queryKey: syncMetaKey }),
            ]);
        },
    });
}
