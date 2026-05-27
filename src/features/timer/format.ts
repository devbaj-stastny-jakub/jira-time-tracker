/** Time/format helpers for the timer feature. Records store UTC ISO-8601. */

const pad = (n: number) => String(n).padStart(2, '0');

/** Elapsed milliseconds as `H:MM:SS` (hours uncapped). */
export function formatElapsed(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${pad(m)}:${pad(s)}`;
}

/** Elapsed milliseconds as `H:MM` (minute granularity, hours uncapped). */
export function formatElapsedMinutes(ms: number): string {
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${pad(m)}`;
}

/** A duration in milliseconds as `Xh Ym` (or `Ym`). */
export function formatDurationMs(ms: number): string {
    const minutes = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** A duration between two UTC ISO instants as `Xh Ym` (or `Ym`). */
export function formatDuration(startIso: string, endIso: string): string {
    return formatDurationMs(new Date(endIso).getTime() - new Date(startIso).getTime());
}

/** Local wall-clock `HH:mm` for a UTC ISO instant. */
export function formatClock(iso: string): string {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local `yyyy-MM-dd` for a Date (for `<input type="date">`). */
export function toDateValue(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local `HH:mm` for a Date (for `<input type="time">`). */
export function toTimeValue(d: Date): string {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const toMinutes = (timeStr: string): number | null => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
    const [h, mi] = parts;
    return h * 60 + mi;
};

/**
 * Given a `start` and `end` (`HH:mm`), return a new `end` so the duration is
 * rounded up to the next 15-minute increment, keeping `start` fixed
 * (e.g. `15:29`–`16:49` → `15:29`–`16:59`). Durations already on a 15-minute
 * boundary are unchanged. Clamps the new end to `23:59` so it never rolls over
 * into the next day. Returns `end` unchanged if either input is malformed or
 * end is not after start.
 */
export function roundDurationUp15(startStr: string, endStr: string): string {
    const start = toMinutes(startStr);
    const end = toMinutes(endStr);
    if (start === null || end === null || end <= start) return endStr;
    const rounded = Math.ceil((end - start) / 15) * 15;
    const newEnd = Math.min(start + rounded, 24 * 60 - 1);
    return `${pad(Math.floor(newEnd / 60))}:${pad(newEnd % 60)}`;
}

/**
 * Combine a local `yyyy-MM-dd` date and `HH:mm` time into a UTC ISO instant.
 * Returns null if either part is missing/malformed.
 */
export function localToUtcIso(dateStr: string, timeStr: string): string | null {
    const dateParts = dateStr.split('-').map(Number);
    const timeParts = timeStr.split(':').map(Number);
    if (dateParts.length !== 3 || timeParts.length !== 2) return null;
    const [y, mo, d] = dateParts;
    const [h, mi] = timeParts;
    if ([y, mo, d, h, mi].some(Number.isNaN)) return null;
    return new Date(y, mo - 1, d, h, mi, 0, 0).toISOString();
}

/** Parse a local `yyyy-MM-dd` value into a Date (local midnight), or null. */
export function fromDateValue(dateStr: string): Date | null {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const [y, mo, d] = parts;
    return new Date(y, mo - 1, d);
}

/** Human-readable date label for a picker trigger, e.g. "Wed, 27 May 2026". */
export function formatDateLabel(date: Date): string {
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

/** Assemble the full Jira issue key from a project key and the typed number. */
export function ticketKey(projectKey: string | undefined, ticketNumber: string): string {
    if (!projectKey) return ticketNumber;
    return `${projectKey}-${ticketNumber}`;
}
