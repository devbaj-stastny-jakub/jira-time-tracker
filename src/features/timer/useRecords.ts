import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notifyRecordsChanged } from './cross-window';
import {
    type RecordInput,
    createRecord,
    deleteRecord,
    listTodayRecords,
    updateRecord,
} from './records';
import { useActiveTimer } from './useActiveTimer';

export const todayRecordsKey = ['time-records', 'today'] as const;

/** Today's records (local day), newest first. */
export function useTodayRecords() {
    return useQuery({
        queryKey: todayRecordsKey,
        queryFn: listTodayRecords,
    });
}

/**
 * Total tracked milliseconds for today: the sum of completed records plus the
 * live elapsed of the running timer (if any). Durations are summed in raw ms —
 * not per-record rounded minutes — so the number is exact. Re-renders once a
 * minute while a timer runs so the total keeps climbing without per-second churn.
 */
export function useTodayTotal(): number {
    const { data: records } = useTodayRecords();
    const { data: active } = useActiveTimer();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, [active]);

    const completed = (records ?? []).reduce(
        (sum, r) => sum + (new Date(r.endAt).getTime() - new Date(r.startAt).getTime()),
        0,
    );
    const running = active ? Math.max(0, now - new Date(active.startAt).getTime()) : 0;
    return completed + running;
}

export function useCreateRecord() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: RecordInput) => createRecord(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: todayRecordsKey });
            notifyRecordsChanged();
        },
    });
}

export function useUpdateRecord() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: RecordInput }) =>
            updateRecord(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: todayRecordsKey });
            notifyRecordsChanged();
        },
    });
}

export function useDeleteRecord() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteRecord(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: todayRecordsKey });
            notifyRecordsChanged();
        },
    });
}
