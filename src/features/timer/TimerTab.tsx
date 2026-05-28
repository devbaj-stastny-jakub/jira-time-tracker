import { useEffect, useState } from 'react';
import { Play, Square, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ActiveTimer } from './active-timer';
import { type Classification, ClassificationFields } from './ClassificationFields';
import { formatElapsed } from './format';
import {
    useActiveTimer,
    useDiscardTimer,
    usePatchActiveTimer,
    useStartTimer,
    useStopTimer,
} from './useActiveTimer';

/** Start/stop mode: one running timer, classified before it can be stopped. */
export function TimerTab({
    onStopped,
    compact = false,
}: { onStopped?: () => void; compact?: boolean } = {}) {
    const { data: active, isPending } = useActiveTimer();
    const start = useStartTimer();

    if (isPending) {
        return <Skeleton className="mx-auto h-44 w-full max-w-sm rounded-3xl" />;
    }

    if (!active) {
        return (
            <div
                className={cn(
                    'flex flex-col items-center text-center',
                    compact ? 'gap-3 py-2' : 'gap-6 py-6',
                )}
            >
                <p className="eyebrow">Ready</p>
                {/* Ghost clock face: the instrument at rest. */}
                <span
                    className={cn(
                        'font-mono leading-none font-semibold tracking-tight tabular-nums text-muted-foreground/20 select-none',
                        compact ? 'text-4xl' : 'text-6xl',
                    )}
                >
                    0:00:00
                </span>
                <Button
                    size={compact ? 'default' : 'lg'}
                    className="rounded-full px-6 shadow-sm shadow-primary/20"
                    onClick={() => start.mutate()}
                    disabled={start.isPending}
                >
                    <Play /> Start timer
                </Button>
                {compact ? null : (
                    <p className="text-xs text-muted-foreground">
                        Picks up the project from your last entry.
                    </p>
                )}
            </div>
        );
    }

    // Key on startAt so a freshly started timer remounts with a blank draft,
    // seeded once from the store value (no setState-in-effect needed).
    return (
        <RunningTimer
            key={active.startAt}
            active={active}
            onStopped={onStopped}
            compact={compact}
        />
    );
}

function RunningTimer({
    active,
    onStopped,
    compact,
}: {
    active: ActiveTimer;
    onStopped?: () => void;
    compact: boolean;
}) {
    const patch = usePatchActiveTimer();
    const stop = useStopTimer();
    const discard = useDiscardTimer();

    const [draft, setDraft] = useState<Classification>(() => ({
        projectId: active.projectId,
        ticketNumber: active.ticketNumber,
        tagIds: active.tagIds,
    }));

    const update = (p: Partial<Classification>) => {
        const next = { ...draft, ...p };
        setDraft(next);
        patch.mutate(next);
    };

    const canStop = !!draft.projectId && draft.ticketNumber.trim().length > 0;

    const missing: string[] = [];
    if (!draft.projectId) missing.push('project');
    if (draft.ticketNumber.trim().length === 0) missing.push('ticket');
    const blockedReason = missing.length > 0 ? `Add ${missing.join(' and ')} to save` : null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canStop || stop.isPending) return;
        stop.mutate(undefined, { onSuccess: onStopped });
    };

    return (
        <form onSubmit={handleSubmit} className={compact ? 'space-y-3' : 'space-y-8'}>
            <div
                className={cn(
                    'relative flex flex-col items-center',
                    compact ? 'gap-1' : 'gap-3 py-2',
                )}
            >
                {compact ? (
                    // Quieter live indicator for the small ambient panel.
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-running" />
                        <span className="text-[0.625rem] font-medium tracking-wide text-running uppercase">
                            Live
                        </span>
                    </span>
                ) : (
                    <span className="relative inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 ring-1 ring-primary/15">
                        <span className="relative flex size-2 items-center justify-center">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-running opacity-60" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-running" />
                        </span>
                        <span className="eyebrow text-primary/80">Recording</span>
                    </span>
                )}
                <Elapsed startAt={active.startAt} compact={compact} />
            </div>

            <div className="@container">
                <ClassificationFields idPrefix="timer" value={draft} onChange={update} />
            </div>

            <div className="flex items-center justify-end gap-3">
                {blockedReason ? (
                    <p className="text-xs text-muted-foreground" role="status">
                        {blockedReason}
                    </p>
                ) : null}
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => discard.mutate()}
                        disabled={discard.isPending}
                    >
                        <X /> Discard
                    </Button>
                    <Button
                        type="submit"
                        className="px-5 shadow-sm shadow-primary/20"
                        disabled={!canStop || stop.isPending}
                    >
                        <Square /> Stop & save
                    </Button>
                </div>
            </div>
        </form>
    );
}

/** Live-ticking elapsed time since `startAt` — the console's hero readout. */
function Elapsed({ startAt, compact }: { startAt: string; compact: boolean }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <span
            className={cn(
                'relative inline-flex font-mono leading-none font-semibold tracking-tight tabular-nums',
                compact ? 'text-4xl' : 'text-6xl sm:text-7xl',
            )}
        >
            <TickerText value={formatElapsed(now - new Date(startAt).getTime())} />
        </span>
    );
}

function TickerText({ value }: { value: string }) {
    const chars = Array.from(value);
    return (
        <>
            {chars.map((ch, i) => (
                <TickerChar key={i} value={ch} />
            ))}
        </>
    );
}

/** A single character slot that animates: old char slides up out, new comes up from below. */
function TickerChar({ value }: { value: string }) {
    const [lastSeen, setLastSeen] = useState(value);
    const [from, setFrom] = useState<string | null>(null);

    if (lastSeen !== value) {
        setLastSeen(value);
        setFrom(lastSeen);
    }

    useEffect(() => {
        if (from === null) return;
        const t = setTimeout(() => setFrom(null), 250);
        return () => clearTimeout(t);
    }, [from]);

    return (
        <span className="relative inline-block overflow-hidden align-baseline">
            <span className={from === null ? 'block' : 'invisible block'}>{value}</span>
            {from !== null ? (
                <>
                    <span className="timer-tick-out absolute inset-0 block">{from}</span>
                    <span className="timer-tick-in absolute inset-0 block">{value}</span>
                </>
            ) : null}
        </span>
    );
}
