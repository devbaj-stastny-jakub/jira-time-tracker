import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateLabel, fromDateValue, toDateValue } from './format';

interface Props {
    id?: string;
    /** Local `yyyy-MM-dd` value (matches the record form state). */
    value: string;
    onChange: (value: string) => void;
}

/** Date picker over a `yyyy-MM-dd` string: Calendar in a Popover. */
export function DatePicker({ id, value, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const date = fromDateValue(value) ?? undefined;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        className="w-full justify-between px-3 font-normal"
                    >
                        {date ? formatDateLabel(date) : 'Pick a date'}
                        <CalendarIcon className="opacity-50" />
                    </Button>
                }
            />
            <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                        if (!d) return;
                        onChange(toDateValue(d));
                        setOpen(false);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
