import { cn } from '@/lib/utils';
import { formatDurationMs } from './format';
import { useTodayTotal } from './useRecords';

const HOUR = 3_600_000;
const TARGET = 8 * HOUR;

/** Time-of-day greeting; small human touch above the working surface. */
function greeting(hour: number): string {
    if (hour < 5) return 'Burning the midnight oil';
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

/**
 * Tone for the tracked-today readout, mirroring the old badge thresholds:
 * rose below half a day, amber on the way, emerald once a full day is reached.
 */
function toneFor(ms: number): { text: string; bar: string } {
    if (ms >= 7.5 * HOUR)
        return { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (ms >= 4 * HOUR)
        return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
    return { text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' };
}

/**
 * Page header: today's date, a greeting, and the running total tracked against
 * an 8h day shown as a color-coded mono readout with a slim progress bar.
 */
export function TodayHeading() {
    const total = useTodayTotal();
    const now = new Date();
    const tone = toneFor(total);
    const pct = Math.min(100, (total / TARGET) * 100);

    const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
    const month = now.toLocaleDateString(undefined, { month: 'long' });
    const eyebrow = `${weekday} · ${now.getDate()} ${month}`;

    return (
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="animate-in fade-in slide-in-from-left-2 space-y-2 duration-500">
                <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
                    {eyebrow}
                </p>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                    {greeting(now.getHours())}
                </h1>
            </div>

            <div className="animate-in fade-in slide-in-from-right-2 flex flex-col gap-2 rounded-2xl bg-card px-4 py-2.5 ring-1 ring-border duration-500">
                <div className="flex items-baseline gap-2">
                    <span className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
                        Tracked
                    </span>
                    <span className={cn('font-mono text-lg leading-none font-semibold tabular-nums', tone.text)}>
                        {formatDurationMs(total)}
                    </span>
                    <span className="text-xs text-muted-foreground">/ 8h</span>
                </div>
                <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
                    <div
                        className={cn('h-full rounded-full transition-all duration-700', tone.bar)}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </header>
    );
}
