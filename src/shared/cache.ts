/**
 * Cache policy for synced reference data (projects, tags).
 *
 * The data changes rarely, so we keep it "fresh" for a full day and serve it
 * straight from cache. A long `gcTime` keeps it in memory even when nothing is
 * subscribed (navigating settings <-> worklog) so it isn't dropped after the
 * default 5 minutes. The cache is in-memory only, so a cold app launch refetches
 * on first use; the manual "Sync now" button forces an immediate refetch.
 */
const DAY = 24 * 60 * 60 * 1000;

export const referenceDataCache = {
    staleTime: DAY,
    gcTime: DAY,
} as const;
