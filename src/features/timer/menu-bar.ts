/**
 * macOS menu bar (tray) widget for the active timer. Managed entirely from the
 * frontend via the Tauri JS tray/menu APIs — the running app's webview drives
 * the title each tick, since closing the window only hides it (the app stays
 * resident in the menu bar).
 *
 * - Idle: a hollow dot, title `idle`.
 * - Running: a filled dot + elapsed time (e.g. `1:23:45`).
 * - Left-click: opens a menu with Start / Discard / Show Window / Quit.
 * - Right-click: does nothing.
 */
import { Image } from '@tauri-apps/api/image';
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { TrayIcon } from '@tauri-apps/api/tray';
import { getCurrentWindow } from '@tauri-apps/api/window';

const TRAY_ID = 'timer-tray';
/** Drawn larger than the ~18pt menu bar height so it stays crisp on retina. */
const ICON_SIZE = 36;

/** Set by the React layer so the tray can navigate without importing the router. */
let openTimerPage: (() => void) | null = null;
export function setOpenTimerPage(fn: () => void): void {
    openTimerPage = fn;
}

/** Set by the React layer so the "Start" menu item can start a timer. */
let startTimer: (() => void) | null = null;
export function setStartTimer(fn: () => void): void {
    startTimer = fn;
}

/** Set by the React layer so the "Discard" menu item can drop the running timer. */
let discardTimer: (() => void) | null = null;
export function setDiscardTimer(fn: () => void): void {
    discardTimer = fn;
}

const iconCache = new Map<boolean, Image>();

/**
 * A monochrome dot as an RGBA template image — filled (running) or outlined
 * (idle). Template images use only the alpha channel as a mask, so the shape is
 * drawn opaque black and macOS recolors it for light/dark menu bars.
 */
async function dotIcon(filled: boolean): Promise<Image> {
    const cached = iconCache.get(filled);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext('2d')!;
    const center = ICON_SIZE / 2;
    const stroke = ICON_SIZE * 0.12;
    // Outlined dots need room for the stroke so it isn't clipped at the edges.
    const radius = ICON_SIZE * 0.3 - (filled ? 0 : stroke / 2);
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = stroke;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    if (filled) ctx.fill();
    else ctx.stroke();

    const { data } = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
    const image = await Image.new(new Uint8Array(data.buffer), ICON_SIZE, ICON_SIZE);
    iconCache.set(filled, image);
    return image;
}

async function showTimerWindow(): Promise<void> {
    const win = getCurrentWindow();
    await win.show();
    await win.unminimize();
    await win.setFocus();
    openTimerPage?.();
}

/** Kept so their enabled state can be toggled with the timer's running state. */
let startItem: MenuItem | null = null;
let discardItem: MenuItem | null = null;

async function buildMenu(): Promise<Menu> {
    startItem = await MenuItem.new({
        id: 'start-timer',
        text: 'Start timer',
        action: () => startTimer?.(),
    });
    discardItem = await MenuItem.new({
        id: 'discard-timer',
        text: 'Discard timer',
        action: () => discardTimer?.(),
    });
    const show = await MenuItem.new({
        id: 'show-window',
        text: 'Show Window',
        action: () => void showTimerWindow(),
    });
    const sep1 = await PredefinedMenuItem.new({ item: 'Separator' });
    const sep2 = await PredefinedMenuItem.new({ item: 'Separator' });
    const quit = await PredefinedMenuItem.new({ item: 'Quit', text: 'Quit' });
    return Menu.new({ items: [startItem, discardItem, sep1, show, sep2, quit] });
}

let trayPromise: Promise<TrayIcon> | null = null;

/** Create the tray once (reusing any instance left by a dev hot-reload). */
function ensureTray(): Promise<TrayIcon> {
    trayPromise ??= (async () => {
        const existing = await TrayIcon.getById(TRAY_ID);
        if (existing) return existing;
        return TrayIcon.new({
            id: TRAY_ID,
            menu: await buildMenu(),
            // Left-click opens the menu; right-click has no action handler, so it
            // does nothing.
            showMenuOnLeftClick: true,
            icon: await dotIcon(false),
            iconAsTemplate: true,
        });
    })();
    return trayPromise;
}

let lastRunning: boolean | undefined;
let lastTitle: string | null | undefined;

/**
 * Reflect the current timer state in the menu bar. Cheap to call every tick:
 * the icon and title are only pushed to the OS when they actually change.
 */
export async function syncTray(running: boolean, title: string | null): Promise<void> {
    const tray = await ensureTray();
    if (running !== lastRunning) {
        await tray.setIconWithAsTemplate(await dotIcon(running), true);
        // Can't start a second timer while one runs (single active timer);
        // can only discard while one is running.
        await startItem?.setEnabled(!running);
        await discardItem?.setEnabled(running);
        lastRunning = running;
    }
    if (title !== lastTitle) {
        await tray.setTitle(title);
        lastTitle = title;
    }
}

let closeHooked = false;

/** Closing the window hides it to the menu bar instead of quitting the app. */
export async function hookCloseToHide(): Promise<void> {
    if (closeHooked) return;
    closeHooked = true;
    const win = getCurrentWindow();
    await win.onCloseRequested((event) => {
        event.preventDefault();
        void win.hide();
    });
}
