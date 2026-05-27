import { Badge } from '@/components/ui/badge';
import { formatDurationMs } from './format';
import { useTodayTotal } from './useRecords';

const HOUR = 3_600_000;

/**
 * Color classes by progress toward a fixed 8h day: red below half a day,
 * orange while getting there, green once a full day is essentially reached.
 */
function totalColor(ms: number): string {
    if (ms >= 7.5 * HOUR) return 'bg-green-600 text-white';
    if (ms >= 4 * HOUR) return 'bg-orange-500 text-white';
    return 'bg-red-600 text-white';
}

/** Today's tracked total (completed + running), color-coded against an 8h target. */
export function TodayTotalBadge() {
    const total = useTodayTotal();
    return (
        <Badge className={totalColor(total)}>Total {formatDurationMs(total)}</Badge>
    );
}
