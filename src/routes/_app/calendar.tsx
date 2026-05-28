import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { DayTimeline } from '@/features/timer/DayTimeline';
import { formatDurationMs } from '@/features/timer/format';
import { syncStateOf, type TimeRecord } from '@/features/timer/records';
import { RecordList } from '@/features/timer/RecordList';
import { SyncDayButton } from '@/features/timer/SyncDayButton';
import { useActiveTimer } from '@/features/timer/useActiveTimer';
import { usePendingDeletesInRange, useRecordsBetween } from '@/features/timer/useRecords';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/calendar')({
    component: CalendarPage,
});

const HOUR = 3_600_000;
const TARGET_PER_DAY = 8 * HOUR;
/** Monday-first weekday header. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function startOfDay(d: Date): Date {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
}

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/** Monday-first weekday index (0 = Mon … 6 = Sun). */
function mondayIndex(date: Date): number {
    return (date.getDay() + 6) % 7;
}

/**
 * The days shown for a given month, starting on a Monday. Always 5 weeks; the
 * 6th week is appended only when needed (months whose contents spill past row 5).
 */
function gridDays(year: number, month: number): Date[] {
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - mondayIndex(first));
    const all = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
    const lastRow = all.slice(35);
    return lastRow.every((d) => d.getMonth() !== month) ? all.slice(0, 35) : all;
}

/** Weekdays (Mon-Fri) in `month` from day 1 through min(ref, last-day-of-month). */
function weekdaysThrough(year: number, month: number, ref: Date): number {
    const refDay = startOfDay(ref);
    const firstOfMonth = new Date(year, month, 1);
    if (refDay.getTime() < firstOfMonth.getTime()) return 0;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDay =
        refDay.getFullYear() === year && refDay.getMonth() === month
            ? Math.min(lastDay, refDay.getDate())
            : lastDay;
    let count = 0;
    for (let d = 1; d <= endDay; d++) {
        const wd = new Date(year, month, d).getDay();
        if (wd !== 0 && wd !== 6) count++;
    }
    return count;
}

/** Total weekdays in the month. */
function weekdaysInMonth(year: number, month: number): number {
    return weekdaysThrough(year, month, new Date(year, month + 1, 0));
}

/** ISO 8601 week number (Monday-based, Thursday rule). */
function isoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Rose / amber / emerald tones plus a translucent cell fill for the heatmap. */
function dayTone(ms: number): { text: string; bar: string; fill: string } {
    if (ms >= 7.5 * HOUR)
        return {
            text: 'text-emerald-600 dark:text-emerald-400',
            bar: 'bg-emerald-500',
            fill: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        };
    if (ms >= 4 * HOUR)
        return {
            text: 'text-amber-600 dark:text-amber-400',
            bar: 'bg-amber-500',
            fill: 'bg-amber-500/10 dark:bg-amber-500/15',
        };
    return {
        text: 'text-rose-600 dark:text-rose-400',
        bar: 'bg-rose-500',
        fill: 'bg-rose-500/10 dark:bg-rose-500/15',
    };
}

/** Same palette but graded against an arbitrary (possibly prorated) target. */
function ratioTone(ms: number, target: number): { text: string; bar: string } {
    const ratio = target > 0 ? ms / target : 0;
    if (ratio >= 0.95)
        return { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (ratio >= 0.5)
        return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
    return { text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' };
}

function durationMs(r: TimeRecord): number {
    return new Date(r.endAt).getTime() - new Date(r.startAt).getTime();
}

/**
 * Cell-level sync rollup. Aggregates the per-record states into a single
 * dominant state for the day, in priority order: errored > stale > pending >
 * synced. `null` means "no records" — no dot to draw.
 *
 * Soft-deleted-but-not-yet-pushed rows are added separately by the calendar
 * after this function runs, via {@link escalate} — they need their own query
 * because `listRecordsBetween` filters them out.
 */
type DaySyncState = 'errored' | 'stale' | 'pending' | 'synced';

const SYNC_PRIORITY: Record<DaySyncState, number> = {
    synced: 0,
    pending: 1,
    stale: 2,
    errored: 3,
};

/** Pick the worse of two states. Used to fold pending deletes into the rollup. */
function escalate(
    current: DaySyncState | undefined,
    candidate: DaySyncState,
): DaySyncState {
    if (!current) return candidate;
    return SYNC_PRIORITY[candidate] > SYNC_PRIORITY[current] ? candidate : current;
}

function dominantSyncState(records: TimeRecord[]): DaySyncState | null {
    if (records.length === 0) return null;
    let hasStale = false;
    let hasPending = false;
    for (const r of records) {
        const s = syncStateOf(r);
        if (s === 'errored') return 'errored';
        if (s === 'stale') hasStale = true;
        else if (s === 'never') hasPending = true;
    }
    if (hasStale) return 'stale';
    if (hasPending) return 'pending';
    return 'synced';
}

function localDayKey(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Re-derive "today" every minute so crossing midnight doesn't strand state. */
function useToday(): Date {
    const [today, setToday] = useState(() => startOfDay(new Date()));
    useEffect(() => {
        const id = setInterval(() => {
            const t = startOfDay(new Date());
            setToday((cur) => (cur.getTime() === t.getTime() ? cur : t));
        }, 60_000);
        return () => clearInterval(id);
    }, []);
    return today;
}

function CalendarPage() {
    const today = useToday();
    const [viewed, setViewed] = useState<{ year: number; month: number }>(() => ({
        year: today.getFullYear(),
        month: today.getMonth(),
    }));
    const [selected, setSelected] = useState<Date>(today);

    const days = useMemo(() => gridDays(viewed.year, viewed.month), [viewed]);
    const rangeStartUtc = days[0].toISOString();
    const rangeEndUtc = useMemo(() => {
        const end = new Date(days[days.length - 1]);
        end.setDate(end.getDate() + 1);
        return end.toISOString();
    }, [days]);

    const { data: records, isPending } = useRecordsBetween(rangeStartUtc, rangeEndUtc);
    const { data: pendingDeletes } = usePendingDeletesInRange(rangeStartUtc, rangeEndUtc);
    const { data: active } = useActiveTimer();

    // Re-render once a minute while a timer runs so the running contribution
    // to today's cell and the month total keeps climbing. Idle => no interval.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, [active]);
    const liveMs = active ? Math.max(0, now - new Date(active.startAt).getTime()) : 0;

    const recordsByDay = useMemo(() => {
        const map = new Map<string, TimeRecord[]>();
        for (const r of records ?? []) {
            const k = localDayKey(r.startAt);
            const list = map.get(k);
            if (list) list.push(r);
            else map.set(k, [r]);
        }
        return map;
    }, [records]);

    const totalsByDay = useMemo(() => {
        const map = new Map<string, number>();
        for (const [k, rs] of recordsByDay) {
            map.set(k, rs.reduce((s, r) => s + durationMs(r), 0));
        }
        return map;
    }, [recordsByDay]);

    const syncByDay = useMemo(() => {
        const map = new Map<string, DaySyncState>();
        for (const [k, rs] of recordsByDay) {
            const state = dominantSyncState(rs);
            if (state) map.set(k, state);
        }
        // Pending deletes aren't in `recordsByDay` (filtered by deleted_at), so
        // fold them in here. A failed prior delete attempt is `errored`; otherwise
        // it's pending work like any other unpushed change.
        for (const d of pendingDeletes ?? []) {
            const k = localDayKey(d.startAt);
            const candidate: DaySyncState = d.lastSyncError ? 'errored' : 'pending';
            map.set(k, escalate(map.get(k), candidate));
        }
        return map;
    }, [recordsByDay, pendingDeletes]);

    const selectedRecords = recordsByDay.get(dayKey(selected)) ?? [];

    const goPrevMonth = () =>
        setViewed(({ year, month }) =>
            month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
        );
    const goNextMonth = () =>
        setViewed(({ year, month }) =>
            month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
        );
    const goPrevYear = () => setViewed(({ year, month }) => ({ year: year - 1, month }));
    const goNextYear = () => setViewed(({ year, month }) => ({ year: year + 1, month }));
    const goToday = () => {
        setViewed({ year: today.getFullYear(), month: today.getMonth() });
        setSelected(today);
    };

    const showGridSkeleton = isPending && !records;

    return (
        <div className="mx-auto w-full max-w-5xl space-y-8">
            <CalendarHeading
                year={viewed.year}
                month={viewed.month}
                totalsByDay={totalsByDay}
                liveMs={liveMs}
                today={today}
            />

            <section className="relative overflow-hidden rounded-3xl bg-card ring-1 ring-border">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/6 via-transparent to-transparent"
                />

                <div className="relative space-y-4 p-5 sm:p-6">
                    <CalendarNav
                        onPrevYear={goPrevYear}
                        onPrev={goPrevMonth}
                        onNext={goNextMonth}
                        onNextYear={goNextYear}
                        onToday={goToday}
                    />

                    <div
                        className={cn(
                            'grid grid-cols-7 gap-1.5 transition-opacity duration-300',
                            showGridSkeleton && 'animate-pulse opacity-70',
                        )}
                        aria-busy={isPending || undefined}
                    >
                        {WEEKDAYS.map((label) => (
                            <div
                                key={label}
                                className="px-1 pb-1 text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase"
                            >
                                {label}
                            </div>
                        ))}

                        {days.map((d) => {
                            const isToday = isSameDay(d, today);
                            const k = dayKey(d);
                            return (
                                <DayCell
                                    key={d.toISOString()}
                                    date={d}
                                    viewedMonth={viewed.month}
                                    today={today}
                                    selected={selected}
                                    totalMs={
                                        (totalsByDay.get(k) ?? 0) +
                                        (isToday ? liveMs : 0)
                                    }
                                    isRecording={isToday && Boolean(active)}
                                    syncState={syncByDay.get(k) ?? null}
                                    onSelect={() => setSelected(d)}
                                />
                            );
                        })}
                    </div>
                </div>
            </section>

            <SelectedDayDetail
                date={selected}
                today={today}
                records={selectedRecords}
                isPending={isPending}
            />
        </div>
    );
}

function CalendarHeading({
    year,
    month,
    totalsByDay,
    liveMs,
    today,
}: {
    year: number;
    month: number;
    totalsByDay: Map<string, number>;
    liveMs: number;
    today: Date;
}) {
    const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });

    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    const weekdaysTotal = weekdaysInMonth(year, month);
    const weekdaysElapsed = weekdaysThrough(year, month, today);
    // Prorate to month-to-date for the current month so the bar is meaningful
    // mid-month. Past months get the full target; future months get 0.
    const target = (isCurrentMonth ? weekdaysElapsed : weekdaysTotal) * TARGET_PER_DAY;

    let total = 0;
    let daysLogged = 0;
    for (const [k, ms] of totalsByDay) {
        const [y, m] = k.split('-').map(Number);
        if (y === year && m === month && ms > 0) {
            total += ms;
            daysLogged++;
        }
    }
    if (isCurrentMonth) total += liveMs;

    const tone = ratioTone(total, target);
    const pct = target > 0 ? Math.min(100, (total / target) * 100) : 0;
    const avgMs = daysLogged > 0 ? total / daysLogged : 0;

    const eyebrow = isCurrentMonth
        ? `Week ${isoWeek(today)} · ${weekdaysElapsed} of ${weekdaysTotal} weekdays`
        : `${weekdaysTotal} weekdays`;

    return (
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="animate-in fade-in slide-in-from-left-2 space-y-2 duration-500">
                <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
                    {eyebrow}
                </p>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                    {monthLabel}
                </h1>
            </div>

            <div className="animate-in fade-in slide-in-from-right-2 flex min-w-56 flex-col gap-2 rounded-2xl bg-card px-4 py-2.5 ring-1 ring-border duration-500">
                <div className="flex items-baseline gap-2">
                    <span className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
                        Tracked
                    </span>
                    <span
                        className={cn(
                            'font-mono text-lg leading-none font-semibold tabular-nums',
                            tone.text,
                        )}
                    >
                        {formatDurationMs(total)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        / {formatDurationMs(target)}
                    </span>
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
                            {daysLogged > 0 ? formatDurationMs(avgMs) : '—'}
                        </span>
                    </span>
                    <span>
                        {daysLogged} {daysLogged === 1 ? 'day' : 'days'} logged
                    </span>
                </div>
            </div>
        </header>
    );
}

function CalendarNav({
    onPrevYear,
    onPrev,
    onNext,
    onNextYear,
    onToday,
}: {
    onPrevYear: () => void;
    onPrev: () => void;
    onNext: () => void;
    onNextYear: () => void;
    onToday: () => void;
}) {
    return (
        <div className="flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon-sm" onClick={onPrevYear} aria-label="Previous year">
                <ChevronsLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onPrev} aria-label="Previous month">
                <ChevronLeft />
            </Button>
            <Button variant="ghost" size="sm" onClick={onToday} className="mx-1">
                Today
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onNext} aria-label="Next month">
                <ChevronRight />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onNextYear} aria-label="Next year">
                <ChevronsRight />
            </Button>
        </div>
    );
}

function DayCell({
    date,
    viewedMonth,
    today,
    selected,
    totalMs,
    isRecording,
    syncState,
    onSelect,
}: {
    date: Date;
    viewedMonth: number;
    today: Date;
    selected: Date;
    totalMs: number;
    isRecording: boolean;
    syncState: DaySyncState | null;
    onSelect: () => void;
}) {
    const inMonth = date.getMonth() === viewedMonth;
    const isToday = isSameDay(date, today);
    const isSelected = isSameDay(date, selected);
    const isFuture = date.getTime() > today.getTime();
    const isDisabled = !inMonth || isFuture;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const hasRecords = inMonth && totalMs > 0;

    const tone = hasRecords ? dayTone(totalMs) : null;
    const pct = Math.min(100, (totalMs / TARGET_PER_DAY) * 100);

    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={isDisabled}
            aria-current={isToday ? 'date' : undefined}
            aria-pressed={isSelected}
            className={cn(
                'group relative flex h-20 flex-col justify-between overflow-hidden rounded-xl p-2 text-left ring-1 ring-border transition-[background,box-shadow,opacity] duration-150',
                hasRecords ? tone!.fill : inMonth ? 'bg-muted/30' : 'bg-transparent',
                inMonth && isWeekend && 'ring-rose-500/30 dark:ring-rose-400/30',
                !isDisabled && 'cursor-pointer hover:shadow-sm hover:ring-foreground/30',
                isDisabled && 'opacity-40',
                isToday && !isSelected && 'ring-primary/60',
                isSelected && 'ring-2 ring-primary',
                isSelected && !hasRecords && 'bg-primary/10',
            )}
        >
            {inMonth && isWeekend ? (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0,transparent_5px,var(--color-rose-500)_5px,var(--color-rose-500)_6px)] opacity-15 dark:opacity-25"
                />
            ) : null}
            <div className="relative flex items-start justify-between gap-1">
                <span
                    className={cn(
                        'font-mono text-sm font-semibold tabular-nums',
                        !inMonth && 'text-muted-foreground',
                        isToday && 'text-primary',
                    )}
                >
                    {date.getDate()}
                </span>
                <div className="mt-1 flex items-center gap-1">
                    {inMonth && syncState ? <DaySyncDot state={syncState} /> : null}
                    {isRecording ? (
                        <span
                            className="relative flex size-1.5 items-center justify-center"
                            aria-label="Recording"
                        >
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
                        </span>
                    ) : null}
                </div>
            </div>

            {hasRecords ? (
                <div className="relative space-y-1.5">
                    <span
                        className={cn(
                            'block font-mono text-[0.6875rem] font-semibold tabular-nums',
                            tone!.text,
                        )}
                    >
                        {formatDurationMs(totalMs)}
                    </span>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                        <div
                            className={cn('h-full rounded-full transition-all', tone!.bar)}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            ) : null}
        </button>
    );
}

/**
 * Tiny day-cell sync rollup. Synced shows a soft emerald check (positive
 * affirmation that the day's work is in Jira); pending / stale / errored show
 * a colored dot. `title` doubles as accessible label and native browser tooltip.
 */
function DaySyncDot({ state }: { state: DaySyncState }) {
    const config = DAY_SYNC_DOT_CONFIG[state];
    return (
        <span
            aria-label={config.label}
            title={config.label}
            className={cn('size-1.5 rounded-full', config.color)}
        />
    );
}

const DAY_SYNC_DOT_CONFIG: Record<DaySyncState, { color: string; label: string }> = {
    errored: { color: 'bg-destructive', label: 'Sync failed' },
    stale: { color: 'bg-amber-500', label: 'Edited since last sync' },
    pending: { color: 'bg-muted-foreground/50', label: 'Not yet synced' },
    synced: { color: 'bg-emerald-500/70', label: 'Synced to Jira' },
};

function SelectedDayDetail({
    date,
    today,
    records,
    isPending,
}: {
    date: Date;
    today: Date;
    records: TimeRecord[];
    isPending: boolean;
}) {
    const sameYear = date.getFullYear() === today.getFullYear();
    const eyebrow = date.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: sameYear ? undefined : 'numeric',
    });

    return (
        <div className="space-y-6">
            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
                        {eyebrow}
                    </p>
                    <SyncDayButton date={date} />
                </div>
                <DayTimeline date={date} records={records} />
            </section>

            <RecordList
                records={records}
                isPending={isPending}
                emptyTitle="No entries this day"
                emptyDescription="Pick another day or add an entry on the Timer page."
            />
        </div>
    );
}
