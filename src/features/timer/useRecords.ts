import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    type RecordInput,
    createRecord,
    deleteRecord,
    listTodayRecords,
    updateRecord,
} from './records';

export const todayRecordsKey = ['time-records', 'today'] as const;

/** Today's records (local day), newest first. */
export function useTodayRecords() {
    return useQuery({
        queryKey: todayRecordsKey,
        queryFn: listTodayRecords,
    });
}

export function useCreateRecord() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: RecordInput) => createRecord(input),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: todayRecordsKey }),
    });
}

export function useUpdateRecord() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: RecordInput }) =>
            updateRecord(id, input),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: todayRecordsKey }),
    });
}

export function useDeleteRecord() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteRecord(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: todayRecordsKey }),
    });
}
