import type { Classification } from './ClassificationFields';
import { toDateValue, toTimeValue } from './format';
import { type TimeRecord, latestRecord } from './records';

/** Form state for the manual entry / edit form. */
export interface RecordFormInitial {
    classification: Classification;
    /** yyyy-MM-dd */
    date: string;
    /** HH:mm */
    start: string;
    /** HH:mm */
    end: string;
}

/** Sensible defaults for a fresh manual entry: today, no times filled. */
export function blankInitial(): RecordFormInitial {
    return {
        classification: { projectId: null, ticketNumber: '', tagIds: [] },
        date: toDateValue(new Date()),
        start: '',
        end: '',
    };
}

/**
 * Defaults for a fresh manual entry that chains onto the day's records: the
 * "From" time is prefilled with the latest record's end time so consecutive
 * tasks pick up where the previous one stopped, and the project is preselected
 * from that same record since the next task is usually for the same project.
 * Falls back to blank when the day has no records yet.
 */
export function chainedInitial(records: TimeRecord[]): RecordFormInitial {
    const base = blankInitial();
    const latest = latestRecord(records);
    if (!latest) return base;
    return {
        ...base,
        classification: { ...base.classification, projectId: latest.projectId },
        start: toTimeValue(new Date(latest.endAt)),
    };
}

/** Build a form initial state from an existing record's UTC instants. */
export function initialFromRecord(
    classification: Classification,
    startAt: string,
    endAt: string,
): RecordFormInitial {
    const startDate = new Date(startAt);
    return {
        classification,
        date: toDateValue(startDate),
        start: toTimeValue(startDate),
        end: toTimeValue(new Date(endAt)),
    };
}
