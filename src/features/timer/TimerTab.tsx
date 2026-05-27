import { useEffect, useState } from 'react';
import { Play, Square, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
export function TimerTab() {
    const { data: active, isPending } = useActiveTimer();
    const start = useStartTimer();

    if (isPending) {
        return <Skeleton className="h-40 w-full rounded-3xl" />;
    }

    if (!active) {
        return (
            <div className="flex flex-col items-center gap-4 py-8">
                <p className="text-sm text-muted-foreground">No timer running.</p>
                <Button size="lg" onClick={() => start.mutate()} disabled={start.isPending}>
                    <Play /> Start timer
                </Button>
            </div>
        );
    }

    // Key on startAt so a freshly started timer remounts with a blank draft,
    // seeded once from the store value (no setState-in-effect needed).
    return <RunningTimer key={active.startAt} active={active} />;
}

function RunningTimer({ active }: { active: ActiveTimer }) {
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center gap-1 py-2">
                <Elapsed startAt={active.startAt} />
                <span className="text-xs text-muted-foreground">running</span>
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
                <Button onClick={() => stop.mutate()} disabled={!canStop || stop.isPending}>
                    <Square /> Stop & save
                </Button>
            </div>
        </div>
    );
}

/** Live-ticking elapsed time since `startAt`. */
function Elapsed({ startAt }: { startAt: string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <span className="font-mono text-5xl font-semibold tabular-nums">
            {formatElapsed(now - new Date(startAt).getTime())}
        </span>
    );
}
