import { useProjects } from '@/shared/projects/useProjects';
import { useTags } from '@/shared/tags/useTags';
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
} from '@/components/ui/combobox';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ProjectCombobox } from './ProjectCombobox';

type Tag = { id: string; name: string };

/** The shared "what was this time for" inputs: project, ticket, tags. */
export interface Classification {
    projectId: string | null;
    /** Numeric part only; the project key prefix is shown but not stored here. */
    ticketNumber: string;
    tagIds: string[];
}

interface Props {
    value: Classification;
    onChange: (patch: Partial<Classification>) => void;
    /** Disambiguates label/input ids when more than one form is mounted. */
    idPrefix: string;
}

export function ClassificationFields({ value, onChange, idPrefix }: Props) {
    const { data: projects } = useProjects();
    const { data: tags } = useTags();

    const project = projects?.find((p) => p.id === value.projectId);

    return (
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-3">
            <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-project`}>Project</Label>
                {projects && projects.length > 0 ? (
                    <ProjectCombobox
                        id={`${idPrefix}-project`}
                        projects={projects}
                        value={value.projectId}
                        onChange={(id) =>
                            // Changing project changes the ticket key prefix, so the
                            // number no longer belongs to the old project — clear it.
                            onChange({ projectId: id, ticketNumber: '' })
                        }
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No projects — sync them in Settings.
                    </p>
                )}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-ticket`}>Ticket</Label>
                <InputGroup data-disabled={!project}>
                    <InputGroupAddon>
                        <InputGroupText
                            className={cn(
                                'font-mono',
                                project ? 'text-foreground' : 'text-muted-foreground',
                            )}
                        >
                            {project ? `${project.key}-` : 'PROJ-'}
                        </InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                        id={`${idPrefix}-ticket`}
                        inputMode="numeric"
                        placeholder="123"
                        disabled={!project}
                        value={value.ticketNumber}
                        onChange={(e) =>
                            onChange({ ticketNumber: e.target.value.replace(/\D/g, '') })
                        }
                    />
                </InputGroup>
            </div>

            <div className="space-y-1.5">
                <Label>Tags</Label>
                <TagPicker
                    tags={tags ?? []}
                    selected={value.tagIds}
                    onChange={(tagIds) => onChange({ tagIds })}
                />
            </div>
        </div>
    );
}

interface TagPickerProps {
    tags: Tag[];
    selected: string[];
    onChange: (tagIds: string[]) => void;
}

function TagPicker({ tags, selected, onChange }: TagPickerProps) {
    if (tags.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">No tags — sync them in Settings.</p>
        );
    }

    // base-ui matches values by reference, so derive the selected objects from
    // the same `tags` array that feeds the items list.
    const selectedTags = tags.filter((t) => selected.includes(t.id));

    return (
        <Combobox
            items={tags}
            multiple
            itemToStringValue={(t: Tag) => t.name}
            value={selectedTags}
            onValueChange={(next: Tag[]) => onChange(next.map((t) => t.id))}
        >
            <ComboboxChips>
                <ComboboxValue>
                    {selectedTags.map((t) => (
                        <ComboboxChip key={t.id}>{t.name}</ComboboxChip>
                    ))}
                </ComboboxValue>
                <ComboboxChipsInput placeholder="Add tags" />
            </ComboboxChips>
            <ComboboxContent>
                <ComboboxEmpty>No tags found.</ComboboxEmpty>
                <ComboboxList>
                    {(t: Tag) => (
                        <ComboboxItem key={t.id} value={t}>
                            {t.name}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
