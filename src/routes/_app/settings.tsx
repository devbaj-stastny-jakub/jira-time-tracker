import { createFileRoute } from '@tanstack/react-router';
import { Loader2, RefreshCw } from 'lucide-react';

import { ApiError } from '@/shared/api-error';
import { useProjects } from '@/shared/projects/useProjects';
import { useTags } from '@/shared/tags/useTags';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/_app/settings')({
    component: SettingsPage,
});

function SettingsPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Settings</h1>
            <div className="space-y-4">
                <ProjectsSection />
                <TagsSection />
            </div>
        </div>
    );
}

function ProjectsSection() {
    const query = useProjects();
    return (
        <SyncSection
            title="Jira projects"
            description="Projects pulled from your Jira instance."
            itemNoun="project"
            count={query.data?.length}
            hasData={query.data !== undefined}
            isFetching={query.isFetching}
            isError={query.isError}
            error={query.error}
            updatedAt={query.dataUpdatedAt}
            onSync={() => query.refetch()}
        />
    );
}

function TagsSection() {
    const query = useTags();
    return (
        <SyncSection
            title="Timetracker tags"
            description="Tags pulled from the Everit Timetracker plugin."
            itemNoun="tag"
            count={query.data?.length}
            hasData={query.data !== undefined}
            isFetching={query.isFetching}
            isError={query.isError}
            error={query.error}
            updatedAt={query.dataUpdatedAt}
            onSync={() => query.refetch()}
        />
    );
}

interface SyncSectionProps {
    title: string;
    description: string;
    itemNoun: string;
    count: number | undefined;
    hasData: boolean;
    isFetching: boolean;
    isError: boolean;
    error: unknown;
    updatedAt: number;
    onSync: () => void;
}

function SyncSection({
    title,
    description,
    itemNoun,
    count,
    hasData,
    isFetching,
    isError,
    error,
    updatedAt,
    onSync,
}: SyncSectionProps) {
    return (
        <Card size="sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
                <CardAction>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isFetching}
                        onClick={onSync}
                    >
                        {isFetching ? (
                            <>
                                <Loader2 className="animate-spin" />
                                Syncing…
                            </>
                        ) : (
                            <>
                                <RefreshCw />
                                {isError ? 'Retry' : 'Sync now'}
                            </>
                        )}
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent>
                <SectionStatus
                    itemNoun={itemNoun}
                    count={count}
                    hasData={hasData}
                    isError={isError}
                    error={error}
                    updatedAt={updatedAt}
                />
            </CardContent>
        </Card>
    );
}

function SectionStatus({
    itemNoun,
    count,
    hasData,
    isError,
    error,
    updatedAt,
}: Pick<
    SyncSectionProps,
    'itemNoun' | 'count' | 'hasData' | 'isError' | 'error' | 'updatedAt'
>) {
    if (isError) {
        const auth = error instanceof ApiError && error.isAuth;
        const detail = error instanceof Error ? error.message : String(error);
        return (
            <div className="space-y-1">
                <p className="text-destructive text-sm">
                    {auth
                        ? 'Token rejected — re-check your credentials in onboarding.'
                        : "Couldn't sync. Check your connection and retry."}
                </p>
                {!auth ? (
                    <p className="text-muted-foreground text-xs break-all">{detail}</p>
                ) : null}
            </div>
        );
    }

    if (!hasData) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
            </div>
        );
    }

    if (count === 0) {
        return <p className="text-muted-foreground text-sm">No {itemNoun}s found.</p>;
    }

    return (
        <div className="text-sm">
            <p className="font-medium">
                {count} {itemNoun}
                {count === 1 ? '' : 's'} synced
            </p>
            <p className="text-muted-foreground text-xs">
                Last synced {formatRelative(updatedAt)}
            </p>
        </div>
    );
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "5 minutes ago", "just now", … from a `dataUpdatedAt` timestamp. */
function formatRelative(timestamp: number): string {
    if (!timestamp) return 'never';
    const seconds = Math.round((timestamp - Date.now()) / 1000);
    if (Math.abs(seconds) < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
    return relative.format(Math.round(hours / 24), 'day');
}
