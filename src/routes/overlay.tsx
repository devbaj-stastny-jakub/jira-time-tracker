import { useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { LogicalSize, getCurrentWindow } from '@tauri-apps/api/window';
import { X } from 'lucide-react';

import { ManualTab } from '@/features/timer/ManualTab';
import { TimerTab } from '@/features/timer/TimerTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * The macOS quick-entry overlay (⌃⌥T). A separate webview rendered into the
 * non-activating NSPanel built in Rust (`src-tauri/src/overlay.rs`) — it lives
 * outside the `_app` sidebar layout so it's pure quick-entry chrome. It mirrors
 * the main window's Timer / Manual tabs and dismisses itself on Escape, blur,
 * and after a successful Stop & save or Add entry.
 */
export const Route = createFileRoute('/overlay')({
    component: OverlayPanel,
});

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Fixed panel width; only the height is driven by content. */
const OVERLAY_WIDTH = 400;
/** Outer wrapper padding (`p-2` = 0.5rem on each side) added to the card height. */
const WRAPPER_PADDING = 16;

/** Ask the Rust side to order the panel out (it owns the NSPanel). */
function hideOverlay(): void {
    if (inTauri) void invoke('hide_overlay');
}

function OverlayPanel() {
    const cardRef = useRef<HTMLDivElement>(null);

    // This overlay shares index.html (and its opaque `body` background) with the
    // main window, but runs in its own webview/document — so making *this* body
    // transparent lets only the rounded card paint inside the transparent panel.
    useEffect(() => {
        document.body.classList.add('overlay-window');
        return () => document.body.classList.remove('overlay-window');
    }, []);

    // Escape closes; the panel also hides on blur, which Rust signals via the
    // `overlay-blur` event when the panel resigns key (focus left it).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') hideOverlay();
        };
        window.addEventListener('keydown', onKey);
        const unlisten = inTauri ? listen('overlay-blur', () => hideOverlay()) : null;
        return () => {
            window.removeEventListener('keydown', onKey);
            void unlisten?.then((fn) => fn());
        };
    }, []);

    // Spotlight-style fast capture — the first interactive control in whichever
    // tab the panel opens on takes focus, so the user can type or hit Enter
    // immediately without a mouse hop.
    useEffect(() => {
        const card = cardRef.current;
        if (!card) return;
        const first = card.querySelector<HTMLElement>(
            'input:not([disabled]), button:not([disabled]):not([data-tab-trigger]):not([data-overlay-dismiss])',
        );
        first?.focus();
    }, []);

    // Resize the NSPanel to fit the card, so switching Timer ↔ Manual (or any
    // content change) retunes the window height instead of clipping/scrolling.
    useEffect(() => {
        if (!inTauri) return;
        const card = cardRef.current;
        if (!card) return;
        const win = getCurrentWindow();
        let lastHeight = 0;
        const observer = new ResizeObserver(() => {
            const height = Math.ceil(card.getBoundingClientRect().height) + WRAPPER_PADDING;
            if (height === lastHeight) return;
            lastHeight = height;
            void win.setSize(new LogicalSize(OVERLAY_WIDTH, height));
        });
        observer.observe(card);
        return () => observer.disconnect();
    }, []);

    return (
        <div className="flex min-h-svh items-start justify-center p-2">
            <div
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-label="Jira time tracker — quick entry"
                className="group animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-200 relative w-full overflow-hidden rounded-2xl bg-card/95 shadow-2xl ring-1 ring-border backdrop-blur-xl"
            >
                {/* Hover-revealed close affordance. Esc is the keyboard path; this
                    rescues users who don't know about it. */}
                <button
                    type="button"
                    aria-label="Close"
                    onClick={hideOverlay}
                    data-overlay-dismiss
                    className="absolute right-2 top-2 z-10 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <X className="size-3.5" />
                </button>

                <Tabs defaultValue="timer" className="gap-3 p-3">
                    <TabsList className="self-center h-7 bg-foreground/[0.05] p-1.5 text-xs">
                        <TabsTrigger value="timer" className="h-6 flex-none px-2.5 text-xs data-active:shadow-sm">
                            Timer
                        </TabsTrigger>
                        <TabsTrigger value="manual" className="h-6 flex-none px-2.5 text-xs data-active:shadow-sm">
                            Manual
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="timer">
                        <TimerTab onStopped={hideOverlay} compact />
                    </TabsContent>
                    <TabsContent value="manual">
                        <ManualTab onAdded={hideOverlay} compact />
                    </TabsContent>
                </Tabs>

                <div className="flex items-center justify-center gap-3 border-t bg-muted/30 px-3 py-1.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground/70">
                    <span>
                        <kbd className="font-mono">⏎</kbd> save
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>
                        <kbd className="font-mono">⎋</kbd> close
                    </span>
                </div>
            </div>
        </div>
    );
}
