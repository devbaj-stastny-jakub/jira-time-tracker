import { createFileRoute } from '@tanstack/react-router';
import { Loader2, RefreshCw } from 'lucide-react';

import { ApiError } from '@/shared/api-error';
import { useProjects } from '@/shared/projects/useProjects';
import { useSyncProjects } from '@/shared/projects/sync';
import { useSyncMeta } from '@/shared/sync/sync-meta';
import { useTags } from '@/shared/tags/useTags';
import { useSyncTags } from '@/shared/tags/sync';
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
    const sync = useSyncProjects();
    const meta = useSyncMeta();
    return (
        <SyncSection
            title="Jira projects"
            description="Projects pulled from your Jira instance."
            itemNoun="project"
            count={query.data?.length}
            isSyncing={sync.isPending}
            isError={sync.isError}
            error={sync.error}
            syncedAt={meta.data?.projectsSyncedAt}
            onSync={() => sync.mutate()}
        />
    );
}

function TagsSection() {
    const query = useTags();
    const sync = useSyncTags();
    const meta = useSyncMeta();
    return (
        <SyncSection
            title="Timetracker tags"
            description="Tags pulled from the Everit Timetracker plugin."
            itemNoun="tag"
            count={query.data?.length}
            isSyncing={sync.isPending}
            isError={sync.isError}
            error={sync.error}
            syncedAt={meta.data?.tagsSyncedAt}
            onSync={() => sync.mutate()}
        />
    );
}

interface SyncSectionProps {
    title: string;
    description: string;
    itemNoun: string;
    /** Persisted row count; undefined until the first DB read resolves. */
    count: number | undefined;
    isSyncing: boolean;
    isError: boolean;
    error: unknown;
    /** Last-synced time (epoch ms); undefined when never synced. */
    syncedAt: number | undefined;
    onSync: () => void;
}

function SyncSection({
    title,
    description,
    itemNoun,
    count,
    isSyncing,
    isError,
    error,
    syncedAt,
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
                        disabled={isSyncing}
                        onClick={onSync}
                    >
                        {isSyncing ? (
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
                    isError={isError}
                    error={error}
                    syncedAt={syncedAt}
                />
            </CardContent>
        </Card>
    );
}

function SectionStatus({
    itemNoun,
    count,
    isError,
    error,
    syncedAt,
}: Pick<SyncSectionProps, 'itemNoun' | 'count' | 'isError' | 'error' | 'syncedAt'>) {
    // The persisted count/time come from the read query + sync-meta and survive a
    // failed sync, so we show them whenever we have them and render a sync error
    // *additively* beneath — telling the user they still have last-good data.
    return (
        <div className="space-y-2">
            {count === undefined ? (
                <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                </div>
            ) : count === 0 ? (
                <p className="text-muted-foreground text-sm">
                    No {itemNoun}s yet — sync to pull them in.
                </p>
            ) : (
                <div className="text-sm">
                    <p className="font-medium">
                        {count} {itemNoun}
                        {count === 1 ? '' : 's'} synced
                    </p>
                    <p className="text-muted-foreground text-xs">
                        Last synced {formatRelative(syncedAt)}
                    </p>
                </div>
            )}

            {isError ? <SyncError error={error} /> : null}
        </div>
    );
}

/** The error from the most recent failed sync, shown beneath any existing data. */
function SyncError({ error }: { error: unknown }) {
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

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "5 minutes ago", "just now", … from a `syncedAt` timestamp. */
function formatRelative(timestamp: number | undefined): string {
    if (!timestamp) return 'never';
    const seconds = Math.round((timestamp - Date.now()) / 1000);
    if (Math.abs(seconds) < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
    return relative.format(Math.round(hours / 24), 'day');
}
