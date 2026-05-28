import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { type Credentials, saveCredentials } from '@/shared/credentials/credentials';
import { credentialsKey, useCredentials } from '@/shared/credentials/useCredentials';
import { projectsKey } from '@/shared/projects/useProjects';
import { syncProjects } from '@/shared/projects/sync';
import { syncMetaKey } from '@/shared/sync/sync-meta';
import { tagsKey } from '@/shared/tags/useTags';
import { syncTags } from '@/shared/tags/sync';
import {
    type ValidationResult,
    getJiraCurrentUser,
    validateJira,
    validateTimetracker,
} from './api';

interface TokenCheck {
    ok: boolean;
    status?: number;
    error?: string;
}

export interface ValidationReport {
    jira: TokenCheck;
    timetracker: TokenCheck;
    allValid: boolean;
}

function toCheck(result: PromiseSettledResult<ValidationResult>): TokenCheck {
    if (result.status === 'fulfilled') {
        return { ok: result.value.ok, status: result.value.status };
    }
    return { ok: false, error: String(result.reason) };
}

/**
 * Runs both token validations and reports per-token results. The mutation
 * always resolves (never rejects) so the UI can render which token failed.
 */
export function useValidateTokens() {
    return useMutation<ValidationReport, never, Credentials>({
        mutationFn: async (credentials) => {
            const [jira, timetracker] = await Promise.allSettled([
                validateJira(credentials),
                validateTimetracker(credentials),
            ]);
            const jiraCheck = toCheck(jira);
            const ttCheck = toCheck(timetracker);
            return {
                jira: jiraCheck,
                timetracker: ttCheck,
                allValid: jiraCheck.ok && ttCheck.ok,
            };
        },
    });
}

/**
 * Persists credentials to the keychain, runs a one-time initial sync so the app
 * opens with projects/tags ready to classify, then routes in. The sync is
 * awaited (the user expects setup work here) but never blocks entry: if it
 * fails, we still navigate and the user can sync from Settings later.
 */
export function useCompleteOnboarding() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    return useMutation<void, Error, Credentials>({
        mutationFn: async (credentials) => {
            await saveCredentials(credentials);
            // Don't let a sync failure strand onboarding — entry must proceed.
            await Promise.allSettled([syncProjects(credentials), syncTags(credentials)]);
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: credentialsKey }),
                queryClient.invalidateQueries({ queryKey: projectsKey }),
                queryClient.invalidateQueries({ queryKey: tagsKey }),
                queryClient.invalidateQueries({ queryKey: syncMetaKey }),
            ]);
            navigate({ to: '/' });
        },
    });
}

export const currentUserKey = ['jira', 'current-user'] as const;

/**
 * Persists edited credentials from the user page. Validation has already passed
 * (the form gates Save on it), so this only writes the keychain and refreshes
 * the queries whose results depend on the credentials — the connected Jira user
 * shown in the sidebar. Synced projects/tags in SQLite are intentionally left
 * untouched: a token/URL fix on the same instance doesn't invalidate them, and
 * a true instance switch is handled by Settings → "Sync now".
 */
export function useUpdateCredentials() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, Credentials>({
        mutationFn: (credentials) => saveCredentials(credentials),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: credentialsKey }),
                queryClient.invalidateQueries({ queryKey: currentUserKey }),
            ]);
        },
    });
}

/**
 * The connected Jira user, derived from the stored credentials. Disabled until
 * credentials exist so it never runs during onboarding.
 */
export function useCurrentUser() {
    const { data: credentials } = useCredentials();
    return useQuery({
        queryKey: currentUserKey,
        queryFn: () => getJiraCurrentUser(credentials!),
        enabled: !!credentials,
    });
}
