import { useQuery } from '@tanstack/react-query';
import { type Store, load } from '@tauri-apps/plugin-store';

/**
 * Per-resource "last synced" timestamps (epoch ms), persisted as a JSON
 * singleton via `tauri-plugin-store`. Kept outside SQLite because they describe
 * the *sync operation*, not any row — and the active timer already establishes
 * this store pattern. A missing value means "never synced".
 */
export interface SyncMeta {
    projectsSyncedAt?: number;
    tagsSyncedAt?: number;
}

const STORE_FILE = 'sync.json';
const META_KEY = 'meta';

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
    // autoSave is on by default (100ms debounce), so writes flush without us
    // managing saves explicitly.
    storePromise ??= load(STORE_FILE);
    return storePromise;
}

export async function getSyncMeta(): Promise<SyncMeta> {
    const store = await getStore();
    return (await store.get<SyncMeta>(META_KEY)) ?? {};
}

/** Stamp one resource's last-synced time, leaving the other untouched. */
export async function setSyncedAt(resource: keyof SyncMeta, when = Date.now()): Promise<void> {
    const store = await getStore();
    const current = (await store.get<SyncMeta>(META_KEY)) ?? {};
    await store.set(META_KEY, { ...current, [resource]: when });
}

export const syncMetaKey = ['sync-meta'] as const;

/**
 * Reactive read of the last-synced timestamps. Sync mutations invalidate
 * {@link syncMetaKey} so the displayed time refreshes the moment a sync
 * completes; reading the persisted store on mount survives an app restart.
 */
export function useSyncMeta() {
    return useQuery({
        queryKey: syncMetaKey,
        queryFn: getSyncMeta,
        staleTime: Infinity,
    });
}
