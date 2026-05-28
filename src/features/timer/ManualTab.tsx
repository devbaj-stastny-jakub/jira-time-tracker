import { useState } from 'react';

import { chainedInitial } from './form-state';
import { RecordForm } from './RecordForm';
import { useCreateRecord, useTodayRecords } from './useRecords';

/** Manual entry mode: enter a date and from/to times by hand. */
export function ManualTab({
    onAdded,
    compact = false,
}: { onAdded?: () => void; compact?: boolean } = {}) {
    const create = useCreateRecord();
    const { data: records = [] } = useTodayRecords();
    // Remount the form after a successful save to reset it to fresh defaults.
    const [formKey, setFormKey] = useState(0);

    const initial = chainedInitial(records);

    return (
        <RecordForm
            // Re-key on the chained start so the form picks up the new default
            // once today's records load and after each save extends the chain.
            key={`${formKey}-${initial.start}`}
            idPrefix="manual"
            initial={initial}
            heroReadout
            compact={compact}
            submitLabel="Add entry"
            isPending={create.isPending}
            onSubmit={(input) =>
                create.mutate(input, {
                    onSuccess: () => {
                        setFormKey((k) => k + 1);
                        onAdded?.();
                    },
                })
            }
        />
    );
}
