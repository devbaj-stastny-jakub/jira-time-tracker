import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { emit, listen } from '@tauri-apps/api/event';

import { activeTimerKey } from './useActiveTimer';
import { recordsRootKey } from './useRecords';

/** True inside the Tauri webview; false in a plain-browser `vite` dev server. */
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const TIMER_CHANGED = 'timer-changed';
const RECORDS_CHANGED = 'records-changed';

/**
 * The main window and the quick-entry overlay each run their own webview, so
 * their React Query caches are independent. The active timer (tauri-plugin-store)
 * and the records (SQLite) are a shared source of truth; these events are how a
 * mutation in one window tells the other to re-read it.
 */
export function notifyTimerChanged(): void {
    if (inTauri) void emit(TIMER_CHANGED);
}

export function notifyRecordsChanged(): void {
    if (inTauri) void emit(RECORDS_CHANGED);
}

/**
 * Listen for cross-window change events and invalidate the matching queries.
 * Mount once near the root of every window. (The emitting window also receives
 * its own event; re-invalidating an already-fresh query is a cheap no-op.)
 */
export function useCrossWindowSync(): void {
    const queryClient = useQueryClient();
    useEffect(() => {
        if (!inTauri) return;
        const unlisten = [
            listen(TIMER_CHANGED, () =>
                queryClient.invalidateQueries({ queryKey: activeTimerKey }),
            ),
            listen(RECORDS_CHANGED, () =>
                queryClient.invalidateQueries({ queryKey: recordsRootKey }),
            ),
        ];
        return () => {
            for (const p of unlisten) void p.then((fn) => fn());
        };
    }, [queryClient]);
}
