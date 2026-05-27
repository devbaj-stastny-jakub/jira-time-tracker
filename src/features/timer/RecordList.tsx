import { useState } from 'react';
import { Clock, Pencil, Trash2 } from 'lucide-react';

import { useProjects } from '@/shared/projects/useProjects';
import { useTags } from '@/shared/tags/useTags';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { initialFromRecord } from './form-state';
import { formatClock, formatDuration, ticketKey } from './format';
import { projectColor } from './projectColor';
import { RecordForm } from './RecordForm';
import type { TimeRecord } from './records';
import { useDeleteRecord, useTodayRecords, useUpdateRecord } from './useRecords';

/** Today's records, newest first, each editable and deletable. */
export function RecordList() {
    const { data: records, isPending } = useTodayRecords();

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
            <Empty className="border">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Clock />
                    </EmptyMedia>
                    <EmptyTitle>No entries today yet</EmptyTitle>
                    <EmptyDescription>
                        Start the timer or add a manual entry to track your time.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <ul className="space-y-2">
            {records.map((record) => (
                <RecordRow key={record.id} record={record} />
            ))}
        </ul>
    );
}

function RecordRow({ record }: { record: TimeRecord }) {
    const { data: projects } = useProjects();
    const { data: tags } = useTags();
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const project = projects?.find((p) => p.id === record.projectId);
    const recordTags = (tags ?? []).filter((t) => record.tagIds.includes(t.id));

    return (
        <li className="flex items-center gap-3 rounded-3xl bg-card px-4 py-3 ring-1 ring-border">
            <span
                className="w-1 self-stretch shrink-0 rounded-full"
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
                    <span>
                        {formatClock(record.startAt)} - {formatClock(record.endAt)}
                    </span>
                    <span>·</span>
                    <span>{formatDuration(record.startAt, record.endAt)}</span>
                    {recordTags.map((t) => (
                        <Badge key={t.id} variant="secondary">
                            {t.name}
                        </Badge>
                    ))}
                </div>
            </div>

            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit entry"
                onClick={() => setEditing(true)}
            >
                <Pencil />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete entry"
                onClick={() => setConfirmingDelete(true)}
            >
                <Trash2 />
            </Button>

            {editing ? (
                <EditRecordDialog record={record} onClose={() => setEditing(false)} />
            ) : null}
            {confirmingDelete ? (
                <DeleteRecordDialog
                    record={record}
                    label={ticketKey(project?.key, record.ticketNumber)}
                    onClose={() => setConfirmingDelete(false)}
                />
            ) : null}
        </li>
    );
}

function EditRecordDialog({ record, onClose }: { record: TimeRecord; onClose: () => void }) {
    const update = useUpdateRecord();

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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit entry</DialogTitle>
                    <DialogDescription>Adjust the project, ticket, tags, or time.</DialogDescription>
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
    label,
    onClose,
}: {
    record: TimeRecord;
    label: string;
    onClose: () => void;
}) {
    const remove = useDeleteRecord();

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Delete entry?</DialogTitle>
                    <DialogDescription>
                        This permanently removes the {label} entry. This can't be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(record.id, { onSuccess: onClose })}
                    >
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
