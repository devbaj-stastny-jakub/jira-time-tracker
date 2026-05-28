import { useEffect, useState } from 'react';

import { useProjects } from '@/shared/projects/useProjects';
import { useTags } from '@/shared/tags/useTags';
import { Badge } from '@/components/ui/badge';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card';
import { formatClock, formatDuration, ticketKey } from './format';
import { projectColor } from './projectColor';
import type { TimeRecord } from './records';
import { useActiveTimer } from './useActiveTimer';
import { useTodayRecords } from './useRecords';

const DAY_MIN = 24 * 60;
/** Interior hour gridlines (every 3h); midnight/end are the track edges. */
const HOUR_TICKS = [3, 6, 9, 12, 15, 18, 21] as const;
const AXIS_LABELS = ['00', '06', '12', '18', '24'] as const;

/** Local midnight (start of the current day) as an epoch-ms base. */
function dayBase(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Left/width as day percentages for an interval, clamped to the 24h track. */
function span(base: number, startIso: string, endMs: number) {
    const startMin = (new Date(startIso).getTime() - base) / 60_000;
    const endMin = (endMs - base) / 60_000;
    const left = clamp(startMin, 0, DAY_MIN);
    const right = clamp(endMin, 0, DAY_MIN);
    return { left: (left / DAY_MIN) * 100, width: (Math.max(0, right - left) / DAY_MIN) * 100 };
}

/**
 * A minimal 24h track of today's worked time: hour gridlines, one
 * semi-transparent block per record (colored by project), the live running
 * timer, and a "now" marker. Hover a finished block for its detail.
 */
export function TodayTimeline() {
    const { data: records } = useTodayRecords();
    const { data: active } = useActiveTimer();
    const [now, setNow] = useState(() => Date.now());

    // Advance the "now" marker (and the running block) once a minute — a minute
    // is invisibly small on a 24h bar, so per-second updates aren't worth it.
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    const base = dayBase();
    const nowLeft = (clamp((now - base) / 60_000, 0, DAY_MIN) / DAY_MIN) * 100;
    const runSpan = active ? span(base, active.startAt, now) : null;

    return (
        <div className="space-y-1.5">
            <div className="relative h-10 w-full overflow-hidden rounded-2xl bg-muted/60 ring-1 ring-border">
                {HOUR_TICKS.map((h) => (
                    <span
                        key={h}
                        aria-hidden
                        className="absolute inset-y-0 w-px bg-border/70"
                        style={{ left: `${(h / 24) * 100}%` }}
                    />
                ))}

                {(records ?? []).map((record) => (
                    <RecordBlock key={record.id} record={record} base={base} />
                ))}

                {runSpan && runSpan.width > 0 ? (
                    <div
                        className="absolute inset-y-1 animate-pulse rounded-l-md border border-r-0"
                        style={{
                            left: `${runSpan.left}%`,
                            width: `${runSpan.width}%`,
                            backgroundColor: `${projectColor(active?.projectId)}80`,
                            borderColor: projectColor(active?.projectId),
                        }}
                        aria-label="Running timer"
                    />
                ) : null}

                {/* "Now" marker: a slim red line capped with a dot at the top. */}
                <div
                    className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-rose-500"
                    style={{ left: `${nowLeft}%` }}
                    aria-label="Now"
                >
                    <span className="absolute -top-px left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-rose-500" />
                </div>
            </div>

            <div className="flex justify-between px-0.5 font-mono text-[0.625rem] font-medium tabular-nums text-muted-foreground/50">
                {AXIS_LABELS.map((label) => (
                    <span key={label}>{label}</span>
                ))}
            </div>
        </div>
    );
}

function RecordBlock({ record, base }: { record: TimeRecord; base: number }) {
    const { data: projects } = useProjects();
    const { data: tags } = useTags();

    const { left, width } = span(base, record.startAt, new Date(record.endAt).getTime());
    if (width <= 0) return null;

    const project = projects?.find((p) => p.id === record.projectId);
    const recordTags = (tags ?? []).filter((t) => record.tagIds.includes(t.id));
    const label = ticketKey(project?.key, record.ticketNumber);

    return (
        <HoverCard>
            <HoverCardTrigger
                render={<div />}
                className="absolute inset-y-1 cursor-default rounded-md border transition hover:brightness-125"
                style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: `${projectColor(record.projectId)}B3`,
                    borderColor: projectColor(record.projectId),
                }}
            />
            <HoverCardContent className="gap-3">
                <div className="flex items-center gap-2">
                    <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: projectColor(record.projectId) }}
                        aria-hidden
                    />
                    <span className="font-mono text-sm font-medium">{label}</span>
                    {project ? (
                        <span className="truncate text-xs text-muted-foreground">{project.name}</span>
                    ) : null}
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-3 py-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatClock(record.startAt)} – {formatClock(record.endAt)}
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                        {formatDuration(record.startAt, record.endAt)}
                    </span>
                </div>
                {recordTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {recordTags.map((t) => (
                            <Badge key={t.id} variant="secondary">
                                {t.name}
                            </Badge>
                        ))}
                    </div>
                ) : null}
            </HoverCardContent>
        </HoverCard>
    );
}
