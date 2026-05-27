import { useQuery } from '@tanstack/react-query';

import { referenceDataCache } from '@/shared/cache';
import { useCredentials } from '@/shared/credentials/useCredentials';
import { getTimetrackerTags } from './api';

export const tagsKey = ['timetracker', 'tags'] as const;

/**
 * The synced Timetracker tags. Auto-fetches on demand once credentials exist
 * (shared by the settings section and the worklog UI) and caches for a day.
 * Call `query.refetch()` to force an immediate re-sync.
 */
export function useTags() {
    const { data: credentials } = useCredentials();
    return useQuery({
        queryKey: tagsKey,
        queryFn: () => getTimetrackerTags(credentials!),
        enabled: !!credentials,
        ...referenceDataCache,
    });
}
