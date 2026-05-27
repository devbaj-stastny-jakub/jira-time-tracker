import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { type Credentials, loadCredentials, saveCredentials } from './credentials';
import {
    type ValidationResult,
    getJiraCurrentUser,
    validateJira,
    validateTimetracker,
} from './api';

export const onboardingStatusKey = ['onboarding', 'credentials'] as const;

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
            await queryClient.invalidateQueries({ queryKey: onboardingStatusKey });
            navigate({ to: '/' });
        },
    });
}

/** Reads stored credentials from the keychain (null when not onboarded). */
export function useOnboardingStatus() {
    return useQuery({
        queryKey: onboardingStatusKey,
        queryFn: loadCredentials,
    });
}

export const currentUserKey = ['jira', 'current-user'] as const;

/**
 * The connected Jira user, derived from the stored credentials. Disabled until
 * credentials exist so it never runs during onboarding.
 */
export function useCurrentUser() {
    const status = useOnboardingStatus();
    const credentials = status.data;
    return useQuery({
        queryKey: currentUserKey,
        queryFn: () => getJiraCurrentUser(credentials!),
        enabled: !!credentials,
    });
}
