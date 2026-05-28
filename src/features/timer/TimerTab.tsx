import { useEffect, useState } from 'react';
import { Play, Square, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ActiveTimer } from './active-timer';
import { type Classification, ClassificationFields } from './ClassificationFields';
import { formatElapsed } from './format';
import { projectColor } from './projectColor';
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
                <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground/60 uppercase">
                    Ready
                </p>
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
    // The glow tracks the selected project so the console takes on its color.
    const accent = projectColor(draft.projectId);

    return (
        <div className={compact ? 'space-y-3' : 'space-y-8'}>
            <div
                className={cn(
                    'relative flex flex-col items-center',
                    compact ? 'gap-1' : 'gap-3 py-2',
                )}
            >
                {/* Soft radial bloom in the project's color, behind the readout. */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl transition-colors duration-700"
                    style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
                />
                <span className="relative inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 ring-1 ring-primary/15">
                    <span className="relative flex size-2 items-center justify-center">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
                    </span>
                    <span className="text-[0.625rem] font-semibold tracking-[0.18em] text-primary/80 uppercase">
                        Recording
                    </span>
                </span>
                <Elapsed startAt={active.startAt} compact={compact} />
            </div>

            <div className="@container">
                <ClassificationFields idPrefix="timer" value={draft} onChange={update} />
            </div>

            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={() => discard.mutate()}
                    disabled={discard.isPending}
                >
                    <X /> Discard
                </Button>
                <Button
                    className="px-5 shadow-sm shadow-primary/20"
                    onClick={() => stop.mutate(undefined, { onSuccess: onStopped })}
                    disabled={!canStop || stop.isPending}
                >
                    <Square /> Stop & save
                </Button>
            </div>
        </div>
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
                'relative font-mono leading-none font-semibold tracking-tight tabular-nums',
                compact ? 'text-4xl' : 'text-6xl sm:text-7xl',
            )}
        >
            {formatElapsed(now - new Date(startAt).getTime())}
        </span>
    );
}
