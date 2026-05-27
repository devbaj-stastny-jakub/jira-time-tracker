import { invoke } from '@tauri-apps/api/core';

/**
 * Connection credentials, mirrors the `Credentials` struct in src-tauri/src/lib.rs.
 * Stored as a single JSON blob in the OS keychain.
 *
 * Lives in `shared/` because both onboarding and the reference-data modules
 * (projects, tags) read credentials to talk to Jira / Everit.
 */
export interface Credentials {
    base_url: string;
    email: string;
    jira_token: string;
    timetracker_token: string;
}

export function saveCredentials(credentials: Credentials): Promise<void> {
    return invoke('save_credentials', { credentials });
}

export function loadCredentials(): Promise<Credentials | null> {
    return invoke('load_credentials');
}

export function clearCredentials(): Promise<void> {
    return invoke('clear_credentials');
}
