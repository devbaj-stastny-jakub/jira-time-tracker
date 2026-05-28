/**
 * Deterministic per-project color for the timeline. Jira projects carry no
 * color, so we hash the project id into a small curated palette — the same
 * project always gets the same swatch.
 *
 * Colors are CSS variables (--project-1..--project-10) defined in index.css,
 * so they shift between light and dark mode and can be re-themed centrally.
 */
const PALETTE_SIZE = 10;

function hash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

function paletteIndex(projectId: string | null | undefined): number {
    if (!projectId) return 0;
    return hash(projectId) % PALETTE_SIZE;
}

/** A stable palette color for a project id, as a CSS `var(...)` reference. */
export function projectColor(projectId: string | null | undefined): string {
    return `var(--project-${paletteIndex(projectId) + 1})`;
}

/**
 * Same palette color but mixed with transparency. `alpha` is a 0..1 ratio
 * (e.g. 0.5 → 50% opacity). Uses `color-mix` so the result is still themable
 * via the CSS variable.
 */
export function projectColorAlpha(projectId: string | null | undefined, alpha: number): string {
    const pct = Math.round(Math.max(0, Math.min(1, alpha)) * 100);
    return `color-mix(in srgb, var(--project-${paletteIndex(projectId) + 1}) ${pct}%, transparent)`;
}
