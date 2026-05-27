import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { formatElapsedMinutes } from './format';
import {
    hookCloseToHide,
    setDiscardTimer,
    setOpenTimerPage,
    setStartTimer,
    syncTray,
} from './menu-bar';
import { useActiveTimer, useDiscardTimer, useStartTimer } from './useActiveTimer';

/** True inside the Tauri webview; false in a plain-browser `vite` dev server. */
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Drives the macOS menu bar widget from the running app. Mount once near the
 * root: it wires close-to-hide + click navigation, then mirrors the active
 * timer's elapsed minutes into the tray title (ticking only while running).
 */
export function useMenuBarTimer(): void {
    const navigate = useNavigate();
    const { data: active } = useActiveTimer();
    const start = useStartTimer();
    const discard = useDiscardTimer();

    useEffect(() => {
        if (!inTauri) return;
        setOpenTimerPage(() => void navigate({ to: '/' }));
        setStartTimer(() => start.mutate());
        setDiscardTimer(() => discard.mutate());
        void hookCloseToHide();
    }, [navigate, start, discard]);

    useEffect(() => {
        if (!inTauri) return;
        const update = () => {
            if (active) {
                const ms = Date.now() - new Date(active.startAt).getTime();
                void syncTray(true, formatElapsedMinutes(ms));
            } else {
                void syncTray(false, 'idle');
            }
        };
        update();
        // Only tick while a timer runs; syncTray repaints just on minute rollover.
        if (!active) return;
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [active]);
}
