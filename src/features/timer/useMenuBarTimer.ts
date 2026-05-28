import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { formatElapsed } from './format';
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
 * The React root mounts in both the main window and the overlay panel. The tray
 * (and close-to-hide) belong to the resident main window only — guard on its
 * label so the overlay webview never spawns a second tray or hijacks close.
 */
const isMainWindow = () => inTauri && getCurrentWindow().label === 'main';

/**
 * Drives the macOS menu bar widget from the running app. Mount once near the
 * root: it wires close-to-hide + click navigation, then mirrors the active
 * timer's elapsed time into the tray title (ticking only while running).
 */
export function useMenuBarTimer(): void {
    const navigate = useNavigate();
    const { data: active } = useActiveTimer();
    const start = useStartTimer();
    const discard = useDiscardTimer();

    useEffect(() => {
        if (!isMainWindow()) return;
        setOpenTimerPage(() => void navigate({ to: '/' }));
        setStartTimer(() => start.mutate());
        setDiscardTimer(() => discard.mutate());
        void hookCloseToHide();
    }, [navigate, start, discard]);

    useEffect(() => {
        if (!isMainWindow()) return;
        const update = () => {
            if (active) {
                const ms = Date.now() - new Date(active.startAt).getTime();
                void syncTray(true, formatElapsed(ms));
            } else {
                void syncTray(false, 'idle');
            }
        };
        update();
        // Only tick while a timer runs; syncTray repaints just on second rollover.
        if (!active) return;
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [active]);
}
