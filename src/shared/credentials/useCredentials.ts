import { useQuery } from '@tanstack/react-query';

import { loadCredentials } from './credentials';

/** Query key for the stored credentials blob. */
export const credentialsKey = ['credentials'] as const;

/**
 * Reads stored credentials from the keychain (null when not onboarded).
 * Reference-data hooks gate on this via `enabled: !!credentials`.
 */
export function useCredentials() {
    return useQuery({
        queryKey: credentialsKey,
        queryFn: loadCredentials,
    });
}
