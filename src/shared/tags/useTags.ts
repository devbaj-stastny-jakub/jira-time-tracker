import { useQuery } from '@tanstack/react-query';

import { listTags } from './db';

export const tagsKey = ['timetracker', 'tags'] as const;

/**
 * The persisted Timetracker tags, read from SQLite. This never hits the network:
 * data is refreshed only by an explicit sync (Settings "Sync now" or the
 * one-time onboarding sync), which invalidates this query. `staleTime: Infinity`
 * keeps it from refetching on its own.
 */
export function useTags() {
    return useQuery({
        queryKey: tagsKey,
        queryFn: listTags,
        staleTime: Infinity,
    });
}
