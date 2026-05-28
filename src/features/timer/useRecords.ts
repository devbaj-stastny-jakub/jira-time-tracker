import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCredentials } from '@/shared/credentials/useCredentials';
import { notifyRecordsChanged } from './cross-window';
import {
    type RecordInput,
    type TimeRecord,
    countPendingForDay,
    createRecord,
    deleteRecord,
    listPendingDeletesInRange,
    listRecordsBetween,
    listTodayRecords,
    updateRecord,
} from './records';
import { pushDay, pushRecord } from './sync';

export const recordsRootKey = ['time-records'] as const;
export const todayRecordsKey = ['time-records', 'today'] as const;
export const recordsBetweenKey = (startUtc: string, endUtc: string) =>
    ['time-records', 'range', startUtc, endUtc] as const;
export const pendingCountKey = (startUtc: string, endUtc: string) =>
    ['time-records', 'pending-count', startUtc, endUtc] as const;
export const pendingDeletesKey = (startUtc: string, endUtc: string) =>
    ['time-records', 'pending-deletes', startUtc, endUtc] as const;

/** Shared mutation key so any in-flight push disables every sync trigger app-wide. */
const syncMutationKey = ['time-records', 'sync'] as const;

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

/**
 * Count of pending push ops (creates + updates + deletes) in a date range.
 * Drives the bulk button's badge. Shares the `recordsRootKey` prefix so every
 * records mutation (create/update/delete/sync) invalidates it.
 */
export function usePendingCountForDay(startUtc: string, endUtc: string) {
    return useQuery({
        queryKey: pendingCountKey(startUtc, endUtc),
        queryFn: () => countPendingForDay(startUtc, endUtc),
    });
}

/**
 * Soft-deleted-but-not-yet-pushed records in a date range. The calendar uses
 * this to colour cells that have *only* pending deletions — they're invisible
 * to `useRecordsBetween` (which filters out `deleted_at`), so without this hook
 * a "synced then deleted" day would falsely look quiescent.
 */
export function usePendingDeletesInRange(startUtc: string, endUtc: string) {
    return useQuery({
        queryKey: pendingDeletesKey(startUtc, endUtc),
        queryFn: () => listPendingDeletesInRange(startUtc, endUtc),
    });
}

/**
 * Push every pending record in `[startUtc, endUtc)`. Continues on per-record
 * failure; the mutation result carries the success/failure counts so the
 * caller can render a summary toast.
 */
export function usePushDay() {
    const { data: credentials } = useCredentials();
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: syncMutationKey,
        mutationFn: ({ startUtc, endUtc }: { startUtc: string; endUtc: string }) =>
            pushDay(credentials!, startUtc, endUtc),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: recordsRootKey });
            notifyRecordsChanged();
        },
    });
}

/**
 * Push one visible record from the per-row "Sync now" menu. Throws on failure
 * so the caller can show a toast; the row's `last_sync_error` is also stamped
 * so the badge updates regardless.
 */
export function usePushRecord() {
    const { data: credentials } = useCredentials();
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: syncMutationKey,
        mutationFn: (record: TimeRecord) => pushRecord(credentials!, record),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: recordsRootKey });
            notifyRecordsChanged();
        },
    });
}

/**
 * True while any sync mutation (bulk or per-record) is in flight, app-wide.
 * Drives the "medium-lock" UI rule: while a push is running, every sync
 * trigger is disabled, but row edits stay free.
 */
export function useIsSyncing(): boolean {
    return useIsMutating({ mutationKey: syncMutationKey }) > 0;
}
