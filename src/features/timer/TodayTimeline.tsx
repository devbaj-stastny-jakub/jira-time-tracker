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
 * A minimal 24h track of today's worked time: one semi-transparent block per
 * record (colored by project), the live running timer, and a "now" marker.
 * Hover a finished block for its ticket, project, time, duration and tags.
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
        <div className="relative h-9 w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border">
            {(records ?? []).map((record) => (
                <RecordBlock key={record.id} record={record} base={base} />
            ))}

            {runSpan && runSpan.width > 0 ? (
                <div
                    className="absolute inset-y-1 animate-pulse rounded-md border"
                    style={{
                        left: `${runSpan.left}%`,
                        width: `${runSpan.width}%`,
                        backgroundColor: `${projectColor(active?.projectId)}80`,
                        borderColor: projectColor(active?.projectId),
                    }}
                    aria-label="Running timer"
                />
            ) : null}

            <div
                className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-red-500"
                style={{ left: `${nowLeft}%` }}
                aria-label="Now"
            />
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
            <HoverCardContent>
                <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-medium">{label}</span>
                    {project ? (
                        <span className="truncate text-xs text-muted-foreground">{project.name}</span>
                    ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                        {formatClock(record.startAt)} - {formatClock(record.endAt)}
                    </span>
                    <span>·</span>
                    <span>{formatDuration(record.startAt, record.endAt)}</span>
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
