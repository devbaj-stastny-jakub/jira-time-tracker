import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { type Credentials, saveCredentials } from '@/shared/credentials/credentials';
import { credentialsKey, useCredentials } from '@/shared/credentials/useCredentials';
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

/** Persists credentials to the keychain, then routes into the app. */
export function useCompleteOnboarding() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    return useMutation<void, Error, Credentials>({
        mutationFn: saveCredentials,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: credentialsKey });
            navigate({ to: '/' });
        },
    });
}

export const currentUserKey = ['jira', 'current-user'] as const;

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
