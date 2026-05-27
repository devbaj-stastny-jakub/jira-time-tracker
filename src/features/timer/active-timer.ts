import { type Store, load } from '@tauri-apps/plugin-store';

/**
 * The single in-progress start/stop timer, persisted as a JSON singleton via
 * `tauri-plugin-store` so it survives an app restart or crash. A finished record
 * is materialized into SQLite only on stop; until then it lives only here.
 *
 * The timer is started instantly (just `startAt`); project/ticket/tags are
 * filled while it runs and are required only to stop & save.
 */
export interface ActiveTimer {
    /** UTC ISO-8601 instant the timer started. */
    startAt: string;
    projectId: string | null;
    /** Numeric part of the Jira ticket typed so far; may be empty while running. */
    ticketNumber: string;
    tagIds: string[];
}

const STORE_FILE = 'timer.json';
const ACTIVE_KEY = 'active';

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
    // autoSave is on by default (100ms debounce), so the singleton is flushed
    // to disk without us managing saves explicitly.
    storePromise ??= load(STORE_FILE);
    return storePromise;
}

export async function loadActiveTimer(): Promise<ActiveTimer | null> {
    const store = await getStore();
    return (await store.get<ActiveTimer>(ACTIVE_KEY)) ?? null;
}

export async function saveActiveTimer(timer: ActiveTimer): Promise<void> {
    const store = await getStore();
    await store.set(ACTIVE_KEY, timer);
}

export async function clearActiveTimer(): Promise<void> {
    const store = await getStore();
    await store.delete(ACTIVE_KEY);
}
