import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { formatDurationMs } from './format';
import { SyncDayButton } from './SyncDayButton';
import { useActiveTimer } from './useActiveTimer';
import { useTodayRecords } from './useRecords';

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
 * Tone for the tracked-today readout, mirroring the calendar's: rose below half
 * a day, amber on the way, emerald once a full day is reached.
 */
function toneFor(ms: number): { text: string; bar: string } {
    if (ms >= 7.5 * HOUR)
        return { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (ms >= 4 * HOUR)
        return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
    return { text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' };
}

/**
 * Page header: today's date, a greeting, and a tracked-today card with avg
 * per entry and entry count — same shape as the calendar's monthly card.
 */
export function TodayHeading() {
    const { data: records } = useTodayRecords();
    const { data: active } = useActiveTimer();

    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, [active]);

    const completedTotal = (records ?? []).reduce(
        (sum, r) => sum + (new Date(r.endAt).getTime() - new Date(r.startAt).getTime()),
        0,
    );
    const liveMs = active ? Math.max(0, now - new Date(active.startAt).getTime()) : 0;
    const total = completedTotal + liveMs;

    const entryCount = records?.length ?? 0;
    const avgMs = entryCount > 0 ? completedTotal / entryCount : 0;

    const tone = toneFor(total);
    const pct = Math.min(100, (total / TARGET) * 100);

    const nowDate = new Date();
    const weekday = nowDate.toLocaleDateString(undefined, { weekday: 'long' });
    const month = nowDate.toLocaleDateString(undefined, { month: 'long' });
    const eyebrow = `${weekday} · ${nowDate.getDate()} ${month}`;

    return (
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="animate-in fade-in slide-in-from-left-2 space-y-2 duration-500">
                <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
                    {eyebrow}
                </p>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                    {greeting(nowDate.getHours())}
                </h1>
                <SyncDayButton date={nowDate} />
            </div>

            <div className="animate-in fade-in slide-in-from-right-2 flex min-w-56 flex-col gap-2 rounded-2xl bg-card px-4 py-2.5 ring-1 ring-border duration-500">
                <div className="flex items-baseline gap-2">
                    <span className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
                        Tracked
                    </span>
                    <span className={cn('font-mono text-lg leading-none font-semibold tabular-nums', tone.text)}>
                        {formatDurationMs(total)}
                    </span>
                    <span className="text-xs text-muted-foreground">/ 8h</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className={cn('h-full rounded-full transition-all duration-700', tone.bar)}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex items-baseline justify-between gap-3 font-mono text-[0.625rem] tabular-nums text-muted-foreground/70">
                    <span>
                        Avg{' '}
                        <span className="font-semibold text-foreground/80">
                            {entryCount > 0 ? formatDurationMs(avgMs) : '—'}
                        </span>
                    </span>
                    <span>
                        {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                    </span>
                </div>
            </div>
        </header>
    );
}
