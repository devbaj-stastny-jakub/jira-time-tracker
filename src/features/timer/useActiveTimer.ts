import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    type ActiveTimer,
    clearActiveTimer,
    loadActiveTimer,
    saveActiveTimer,
} from './active-timer';
import { notifyRecordsChanged, notifyTimerChanged } from './cross-window';
import { roundDurationUp15Ms } from './format';
import { type TimeRecord, createRecord, latestRecord } from './records';
import { recordsRootKey, todayRecordsKey } from './useRecords';

export const activeTimerKey = ['active-timer'] as const;

/** The running timer (or null). Survives restart via tauri-plugin-store. */
export function useActiveTimer() {
    return useQuery({
        queryKey: activeTimerKey,
        queryFn: loadActiveTimer,
    });
}

/**
 * Start the clock immediately; classification is filled in later. The project
 * is preselected from the day's latest record (same as the manual form) since
 * the next task is usually for the same project.
 */
export function useStartTimer() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const records = queryClient.getQueryData<TimeRecord[]>(todayRecordsKey) ?? [];
            const timer: ActiveTimer = {
                startAt: new Date().toISOString(),
                projectId: latestRecord(records)?.projectId ?? null,
                ticketNumber: '',
                tagIds: [],
            };
            await saveActiveTimer(timer);
            return timer;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: activeTimerKey });
            notifyTimerChanged();
        },
    });
}

/**
 * Patch the running timer's classification (project / ticket / tags). Persists
 * to the store but does NOT invalidate the query — the Timer tab keeps a local
 * draft for snappy typing, and the stop mutation reads the fresh store value.
 */
export function usePatchActiveTimer() {
    return useMutation({
        mutationFn: async (patch: Partial<Omit<ActiveTimer, 'startAt'>>) => {
            const current = await loadActiveTimer();
            if (!current) throw new Error('No active timer to update');
            await saveActiveTimer({ ...current, ...patch });
        },
    });
}

/** Stop the timer: materialize a finished record (end = now) and clear it. */
export function useStopTimer() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const current = await loadActiveTimer();
            if (!current) throw new Error('No active timer to stop');
            if (!current.projectId || !current.ticketNumber.trim()) {
                throw new Error('Project and ticket are required to stop the timer');
            }
            const startMs = new Date(current.startAt).getTime();
            const endMs = startMs + roundDurationUp15Ms(Date.now() - startMs);
            await createRecord({
                projectId: current.projectId,
                ticketNumber: current.ticketNumber.trim(),
                startAt: current.startAt,
                endAt: new Date(endMs).toISOString(),
                tagIds: current.tagIds,
            });
            await clearActiveTimer();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: activeTimerKey });
            queryClient.invalidateQueries({ queryKey: recordsRootKey });
            notifyTimerChanged();
            notifyRecordsChanged();
        },
    });
}

/** Throw away the running timer without saving a record. */
export function useDiscardTimer() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: clearActiveTimer,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: activeTimerKey });
            notifyTimerChanged();
        },
    });
}
