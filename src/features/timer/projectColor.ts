/**
 * Deterministic per-project color for the timeline. Jira projects carry no
 * color, so we hash the project id into a small curated palette — the same
 * project always gets the same swatch, with no storage or configuration.
 *
 * Colors are mid-tone hues chosen to stay legible on both the light and dark
 * timeline track. Blocks are rendered semi-transparent, so overlapping records
 * blend into a darker region.
 */
const PALETTE = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
    '#84cc16', // lime
] as const;

/** Stable 32-bit FNV-1a hash of a string. */
function hash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** A stable palette color for a project id (falls back gracefully for null). */
export function projectColor(projectId: string | null | undefined): string {
    if (!projectId) return PALETTE[0];
    return PALETTE[hash(projectId) % PALETTE.length];
}
