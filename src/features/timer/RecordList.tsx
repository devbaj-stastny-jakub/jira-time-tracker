import { useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    CircleDashed,
    Clock,
    MoreVertical,
    Pencil,
    PencilLine,
    Trash2,
    Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Project } from '@/shared/projects/api';
import type { Tag } from '@/shared/tags/api';
import { useProjects } from '@/shared/projects/useProjects';
import { useTags } from '@/shared/tags/useTags';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { initialFromRecord } from './form-state';
import { formatClock, formatDuration, ticketKey } from './format';
import { projectColor } from './projectColor';
import { RecordForm } from './RecordForm';
import { syncStateOf, type SyncState, type TimeRecord } from './records';
import {
    useDeleteRecord,
    useIsSyncing,
    usePushRecord,
    useUpdateRecord,
} from './useRecords';

interface RecordListProps {
    records: TimeRecord[] | undefined;
    isPending: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
}

/** A list of records, newest first, each editable and deletable. */
export function RecordList({
    records,
    isPending,
    emptyTitle = 'No entries today yet',
    emptyDescription = 'Start the timer or add a manual entry to track your time.',
}: RecordListProps) {
    if (isPending) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-3xl" />
                <Skeleton className="h-16 w-full rounded-3xl" />
            </div>
        );
    }

    if (!records || records.length === 0) {
        return (
            <Empty className="rounded-3xl border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Clock />
                    </EmptyMedia>
                    <EmptyTitle>{emptyTitle}</EmptyTitle>
                    <EmptyDescription>{emptyDescription}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="space-y-2.5">
            <div className="flex items-center gap-2">
                <p className="eyebrow">Entries</p>
                <span className="font-mono text-[0.625rem] font-medium tabular-nums text-muted-foreground/50">
                    {records.length}
                </span>
            </div>
            <ul className="space-y-2">
                {records.map((record) => (
                    <RecordRow key={record.id} record={record} />
                ))}
            </ul>
        </div>
    );
}

function RecordRow({ record }: { record: TimeRecord }) {
    const { data: projects } = useProjects();
    const { data: tags } = useTags();
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const project = projects?.find((p) => p.id === record.projectId);
    const recordTags = (tags ?? []).filter((t) => record.tagIds.includes(t.id));
    const state = syncStateOf(record);
    const isSyncing = useIsSyncing();
    const push = usePushRecord();

    const runSync = () => {
        push.mutate(record, {
            onSuccess: () => toast.success('Synced to Jira'),
            onError: (cause) => {
                const message = cause instanceof Error ? cause.message : String(cause);
                toast.error(`Sync failed: ${message}`);
            },
        });
    };

    // Row click opens edit unless the click originated from a control marked
    // data-no-row-click (sync chip, kebab) — those have their own handlers.
    const handleRowClick = (e: React.MouseEvent<HTMLLIElement>) => {
        if ((e.target as HTMLElement).closest('[data-no-row-click]')) return;
        setEditing(true);
    };

    return (
        <li
            onClick={handleRowClick}
            className="flex cursor-pointer flex-col rounded-2xl bg-card px-4 py-3 ring-1 ring-border transition-colors hover:bg-muted/40"
        >
            <div className="flex items-center gap-3.5">
                <span
                    className="h-9 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: projectColor(record.projectId) }}
                    aria-hidden
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                            {ticketKey(project?.key, record.ticketNumber)}
                        </span>
                        {project ? (
                            <span className="truncate text-sm text-muted-foreground">
                                {project.name}
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums">
                            {formatClock(record.startAt)} – {formatClock(record.endAt)}
                        </span>
                        {recordTags.map((t) => (
                            <Badge key={t.id} variant="secondary">
                                {t.name}
                            </Badge>
                        ))}
                    </div>
                </div>

                <SyncBadge
                    state={state}
                    error={record.lastSyncError}
                    onSync={state !== 'synced' && !isSyncing ? runSync : undefined}
                    isSyncing={push.isPending}
                />

                <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatDuration(record.startAt, record.endAt)}
                </span>

                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Entry options"
                                data-no-row-click
                            />
                        }
                    >
                        <MoreVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(true)}>
                            <Pencil />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={isSyncing || state === 'synced'}
                            onClick={runSync}
                        >
                            <Upload />
                            {state === 'errored' ? 'Retry sync' : 'Sync now'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setConfirmingDelete(true)}
                        >
                            <Trash2 />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {state === 'errored' && record.lastSyncError ? (
                <p className="mt-2 ml-4 text-xs text-destructive/90">
                    {record.lastSyncError}
                </p>
            ) : null}

            {editing ? (
                <EditRecordDialog
                    record={record}
                    project={project}
                    onClose={() => setEditing(false)}
                />
            ) : null}
            {confirmingDelete ? (
                <DeleteRecordDialog
                    record={record}
                    project={project}
                    tags={recordTags}
                    onClose={() => setConfirmingDelete(false)}
                />
            ) : null}
        </li>
    );
}

/**
 * Per-row sync indicator. When the row has unpushed work and `onSync` is
 * provided, the chip is itself the retry/sync button — the primary recovery
 * affordance, with the kebab kept as secondary access. Synced is a static span.
 */
function SyncBadge({
    state,
    error,
    onSync,
    isSyncing,
}: {
    state: SyncState;
    error: string | null;
    onSync?: () => void;
    isSyncing?: boolean;
}) {
    const config = SYNC_BADGE_CONFIG[state];
    const Icon = config.icon;
    const interactive = state !== 'synced' && !!onSync;
    const actionLabel = state === 'errored' ? 'Retry sync' : 'Sync now';

    const chipClass = cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-medium',
        config.tone,
        interactive &&
            'cursor-pointer transition-colors hover:brightness-110 disabled:cursor-default disabled:opacity-60',
    );

    const chip = interactive ? (
        <button
            type="button"
            data-no-row-click
            disabled={isSyncing}
            onClick={onSync}
            className={chipClass}
            aria-label={`${config.label} — ${actionLabel}`}
        >
            <Icon className="size-3" />
            {isSyncing ? 'Syncing…' : config.label}
        </button>
    ) : (
        <span className={chipClass} aria-label={`Sync state: ${config.label}`}>
            <Icon className="size-3" />
            {config.label}
        </span>
    );

    if (state !== 'errored' || !error) return chip;
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger render={chip} />
                <TooltipContent>{actionLabel} — {error}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

const SYNC_BADGE_CONFIG: Record<
    SyncState,
    { icon: typeof CheckCircle2; tone: string; label: string }
> = {
    never: {
        icon: CircleDashed,
        tone: 'border-muted-foreground/20 bg-muted/40 text-muted-foreground',
        label: 'Pending',
    },
    synced: {
        icon: CheckCircle2,
        tone: 'border-success/30 bg-success/10 text-success',
        label: 'Synced',
    },
    stale: {
        icon: PencilLine,
        tone: 'border-warning/30 bg-warning/10 text-warning',
        label: 'Edited',
    },
    errored: {
        icon: AlertTriangle,
        tone: 'border-destructive/30 bg-destructive/10 text-destructive',
        label: 'Failed',
    },
};

function EditRecordDialog({
    record,
    project,
    onClose,
}: {
    record: TimeRecord;
    project: Project | undefined;
    onClose: () => void;
}) {
    const update = useUpdateRecord();
    const accent = projectColor(record.projectId);

    const initial = initialFromRecord(
        {
            projectId: record.projectId,
            ticketNumber: record.ticketNumber,
            tagIds: record.tagIds,
        },
        record.startAt,
        record.endAt,
    );

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <span
                            className="h-9 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: accent }}
                            aria-hidden
                        />
                        <div className="min-w-0 space-y-1">
                            <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground/60 uppercase">
                                Editing entry
                            </p>
                            <DialogTitle className="flex items-baseline gap-2">
                                <span className="font-mono">
                                    {ticketKey(project?.key, record.ticketNumber)}
                                </span>
                                {project ? (
                                    <span className="truncate text-sm font-normal text-muted-foreground">
                                        {project.name}
                                    </span>
                                ) : null}
                            </DialogTitle>
                        </div>
                    </div>
                    <DialogDescription className="sr-only">
                        Adjust the project, ticket, tags, or time for this entry.
                    </DialogDescription>
                </DialogHeader>
                <RecordForm
                    idPrefix={`edit-${record.id}`}
                    initial={initial}
                    submitLabel="Save changes"
                    isPending={update.isPending}
                    onCancel={onClose}
                    onSubmit={(input) =>
                        update.mutate({ id: record.id, input }, { onSuccess: onClose })
                    }
                />
            </DialogContent>
        </Dialog>
    );
}

function DeleteRecordDialog({
    record,
    project,
    tags,
    onClose,
}: {
    record: TimeRecord;
    project: Project | undefined;
    tags: Tag[];
    onClose: () => void;
}) {
    const remove = useDeleteRecord();
    const accent = projectColor(record.projectId);
    const label = ticketKey(project?.key, record.ticketNumber);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/15 ring-inset"
                            aria-hidden
                        >
                            <Trash2 className="size-[1.05rem]" />
                        </span>
                        <div className="space-y-1">
                            <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-destructive/70 uppercase">
                                Delete entry
                            </p>
                            <DialogTitle>This can&apos;t be undone</DialogTitle>
                        </div>
                    </div>
                    <DialogDescription className="sr-only">
                        Permanently remove the {label} time entry.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative overflow-hidden rounded-2xl bg-muted/40 ring-1 ring-border">
                    <span
                        className="absolute inset-y-0 left-0 w-1"
                        style={{ backgroundColor: accent }}
                        aria-hidden
                    />
                    <div className="flex items-center gap-3 py-3 pr-4 pl-5">
                        <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium">{label}</span>
                                {project ? (
                                    <span className="truncate text-sm text-muted-foreground">
                                        {project.name}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span className="font-mono tabular-nums">
                                    {formatClock(record.startAt)} – {formatClock(record.endAt)}
                                </span>
                                {tags.map((t) => (
                                    <Badge key={t.id} variant="secondary">
                                        {t.name}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums">
                            {formatDuration(record.startAt, record.endAt)}
                        </span>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() =>
                            remove.mutate(record.id, {
                                onSuccess: () => {
                                    toast.success('Entry deleted');
                                    onClose();
                                },
                            })
                        }
                    >
                        <Trash2 />
                        Delete entry
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
