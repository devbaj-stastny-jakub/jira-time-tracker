import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';

import type { Project } from '@/shared/projects/api';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
    id?: string;
    projects: Project[];
    value: string | null;
    onChange: (projectId: string) => void;
}

/** Searchable project picker (Popover + Command), filtered by key or name. */
export function ProjectCombobox({ id, projects, value, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const selected = projects.find((p) => p.id === value);

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
                        <span className={selected ? '' : 'text-muted-foreground'}>
                            {selected
                                ? `${selected.key} — ${selected.name}`
                                : 'Select a project'}
                        </span>
                        <ChevronsUpDown className="opacity-50" />
                    </Button>
                }
            />
            <PopoverContent align="start" className="w-(--anchor-width) gap-0 p-0">
                <Command>
                    <CommandInput placeholder="Search projects…" />
                    <CommandList>
                        <CommandEmpty>No projects found.</CommandEmpty>
                        <CommandGroup>
                            {projects.map((p) => (
                                <CommandItem
                                    key={p.id}
                                    // cmdk filters on `value`; include both so the
                                    // user can search by key or by name.
                                    value={`${p.key} ${p.name}`}
                                    data-checked={value === p.id}
                                    onSelect={() => {
                                        onChange(p.id);
                                        setOpen(false);
                                    }}
                                >
                                    {p.key} — {p.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
