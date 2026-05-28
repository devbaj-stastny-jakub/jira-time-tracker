import { Check, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { localDayBoundsUtc } from './records';
import { useIsSyncing, usePendingCountForDay, usePushDay } from './useRecords';

/**
 * "Push to Jira (N)" button for a single local day. Hidden when nothing's
 * pending and no sync is in flight; disabled while *any* sync runs app-wide
 * (the medium-lock rule). Used by both `TodayHeading` and the Calendar's
 * selected-day panel.
 *
 * Pass a `Date` for any local day (today or otherwise). The button derives the
 * UTC `[start, end)` bounds itself and queries pending count + fires `pushDay`
 * against them.
 */
export function SyncDayButton({ date }: { date: Date }) {
    const { startUtc, endUtc } = localDayBoundsUtc(date);
    const { data: pending } = usePendingCountForDay(startUtc, endUtc);
    const isSyncing = useIsSyncing();
    const push = usePushDay();

    const count = pending ?? 0;
    // Positive affirmation when there's nothing to push — keeps the slot
    // occupied instead of leaving a hole where the action used to be.
    if (!isSyncing && count === 0) {
        return (
            <span
                role="status"
                aria-label="All entries synced to Jira"
                className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
            >
                <Check className="size-3" />
                All synced
            </span>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={isSyncing}
            onClick={() => {
                push.mutate(
                    { startUtc, endUtc },
                    {
                        onSuccess: ({ succeeded, failed }) => {
                            if (failed === 0 && succeeded > 0) {
                                toast.success(
                                    `Synced ${succeeded} ${succeeded === 1 ? 'record' : 'records'} to Jira`,
                                );
                            } else if (failed > 0 && succeeded === 0) {
                                toast.error(
                                    `Failed to sync ${failed} ${failed === 1 ? 'record' : 'records'} — see the row for details`,
                                );
                            } else if (failed > 0 && succeeded > 0) {
                                toast.warning(`Synced ${succeeded}, ${failed} failed`);
                            }
                        },
                        onError: (cause) => {
                            const message =
                                cause instanceof Error ? cause.message : String(cause);
                            toast.error(`Sync failed: ${message}`);
                        },
                    },
                );
            }}
        >
            {isSyncing ? (
                <>
                    <Loader2 className="animate-spin" />
                    Syncing…
                </>
            ) : (
                <>
                    <Upload />
                    Push to Jira ({count})
                </>
            )}
        </Button>
    );
}
