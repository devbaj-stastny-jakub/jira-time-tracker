import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notifyRecordsChanged } from './cross-window';
import {
    type RecordInput,
    createRecord,
    deleteRecord,
    listRecordsBetween,
    listTodayRecords,
    updateRecord,
} from './records';

export const recordsRootKey = ['time-records'] as const;
export const todayRecordsKey = ['time-records', 'today'] as const;
export const recordsBetweenKey = (startUtc: string, endUtc: string) =>
    ['time-records', 'range', startUtc, endUtc] as const;

/** Today's records (local day), newest first. */
export function useTodayRecords() {
    return useQuery({
        queryKey: todayRecordsKey,
        queryFn: listTodayRecords,
    });
}

/** Records whose `start_at` falls in `[startUtc, endUtc)`, newest first. */
export function useRecordsBetween(startUtc: string, endUtc: string) {
    return useQuery({
        queryKey: recordsBetweenKey(startUtc, endUtc),
        queryFn: () => listRecordsBetween(startUtc, endUtc),
    });
}

export function useCreateRecord() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: RecordInput) => createRecord(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: recordsRootKey });
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
            queryClient.invalidateQueries({ queryKey: recordsRootKey });
            notifyRecordsChanged();
        },
    });
}

export function useDeleteRecord() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteRecord(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: recordsRootKey });
            notifyRecordsChanged();
        },
    });
}
