import { ChevronsUp } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { ClassificationFields } from './ClassificationFields';
import { DatePicker } from './DatePicker';
import { type RecordFormInitial, blankInitial } from './form-state';
import { formatDuration, localToUtcIso, roundDurationUp15 } from './format';
import type { RecordInput } from './records';

/**
 * Mute the placeholder digits of an empty `<input type="time">`, which WebKit
 * (the macOS Tauri webview) otherwise renders in the normal (black) text colour,
 * making an empty field look like a real value. WebKit's datetime fields inherit
 * the input's `color`, so setting it on the input itself is what takes effect.
 * Returns undefined once a value is present so the text goes back to normal.
 */
const emptyTimeClass = (value: string) => (value ? undefined : 'text-muted-foreground');

interface Props {
    idPrefix: string;
    initial?: RecordFormInitial;
    submitLabel: string;
    isPending: boolean;
    onSubmit: (input: RecordInput) => void;
    onCancel?: () => void;
}

/**
 * The manual entry form: classification plus a date and from/to times. Used both
 * inline (Manual tab) and inside the edit dialog. Rejects end ≤ start; saving is
 * blocked until project, ticket, and a valid time range are present.
 */
export function RecordForm({
    idPrefix,
    initial,
    submitLabel,
    isPending,
    onSubmit,
    onCancel,
}: Props) {
    const [state, setState] = useState<RecordFormInitial>(() => initial ?? blankInitial());

    const startIso = localToUtcIso(state.date, state.start);
    const endIso = localToUtcIso(state.date, state.end);
    const rangeInvalid =
        startIso !== null && endIso !== null && new Date(endIso) <= new Date(startIso);
    const duration =
        startIso !== null && endIso !== null && !rangeInvalid
            ? formatDuration(startIso, endIso)
            : null;

    const canSubmit =
        !!state.classification.projectId &&
        state.classification.ticketNumber.trim().length > 0 &&
        startIso !== null &&
        endIso !== null &&
        !rangeInvalid &&
        !isPending;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit || !startIso || !endIso) return;
        onSubmit({
            projectId: state.classification.projectId!,
            ticketNumber: state.classification.ticketNumber.trim(),
            startAt: startIso,
            endAt: endIso,
            tagIds: state.classification.tagIds,
        });
    }

    return (
        <form onSubmit={handleSubmit} className="@container space-y-4">
            <ClassificationFields
                idPrefix={idPrefix}
                value={state.classification}
                onChange={(patch) =>
                    setState((s) => ({
                        ...s,
                        classification: { ...s.classification, ...patch },
                    }))
                }
            />

            <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-3">
                <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}-date`}>Date</Label>
                    <DatePicker
                        id={`${idPrefix}-date`}
                        value={state.date}
                        onChange={(date) => setState((s) => ({ ...s, date }))}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}-start`}>From</Label>
                    <Input
                        id={`${idPrefix}-start`}
                        type="time"
                        value={state.start}
                        className={emptyTimeClass(state.start)}
                        onChange={(e) => setState((s) => ({ ...s, start: e.target.value }))}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}-end`}>To</Label>
                    <InputGroup>
                        <InputGroupInput
                            id={`${idPrefix}-end`}
                            type="time"
                            value={state.end}
                            aria-invalid={rangeInvalid}
                            className={emptyTimeClass(state.end)}
                            onChange={(e) => setState((s) => ({ ...s, end: e.target.value }))}
                        />
                        <InputGroupAddon align="inline-end">
                            {duration ? <Badge variant="secondary">{duration}</Badge> : null}
                            <InputGroupButton
                                size="icon-xs"
                                aria-label="Round duration up to nearest 15 minutes"
                                title="Round duration up to nearest 15 minutes"
                                disabled={duration === null}
                                onClick={() =>
                                    setState((s) => ({
                                        ...s,
                                        end: roundDurationUp15(s.start, s.end),
                                    }))
                                }
                            >
                                <ChevronsUp />
                            </InputGroupButton>
                        </InputGroupAddon>
                    </InputGroup>
                </div>
            </div>

            {rangeInvalid ? (
                <p className="text-sm text-destructive">End time must be after start time.</p>
            ) : null}

            <div className="flex justify-end gap-2">
                {onCancel ? (
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                ) : null}
                <Button type="submit" disabled={!canSubmit}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
