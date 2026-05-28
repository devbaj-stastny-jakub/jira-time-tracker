import { createFileRoute } from '@tanstack/react-router';
import {
    AlertCircle,
    FolderKanban,
    Loader2,
    RefreshCw,
    Tags,
    type LucideIcon,
} from 'lucide-react';

import { ApiError } from '@/shared/api-error';
import { useProjects } from '@/shared/projects/useProjects';
import { useSyncProjects } from '@/shared/projects/sync';
import { useSyncMeta } from '@/shared/sync/sync-meta';
import { useTags } from '@/shared/tags/useTags';
import { useSyncTags } from '@/shared/tags/sync';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/settings')({
    component: SettingsPage,
});

function SettingsPage() {
    const projectsSync = useSyncProjects();
    const tagsSync = useSyncTags();
    const isSyncingAny = projectsSync.isPending || tagsSync.isPending;

    return (
        <div className="space-y-6">
            <header className="animate-in fade-in slide-in-from-top-3 duration-500 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="eyebrow">Reference data</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sync</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Projects and tags pulled from your Jira instance. Sync to keep
                        the pickers current.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={isSyncingAny}
                    onClick={() => {
                        projectsSync.mutate();
                        tagsSync.mutate();
                    }}
                >
                    {isSyncingAny ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Syncing all…
                        </>
                    ) : (
                        <>
                            <RefreshCw />
                            Sync all
                        </>
                    )}
                </Button>
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
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
        <SyncCard
            icon={FolderKanban}
            title="Jira projects"
            description="Projects pulled from your Jira instance."
            itemNoun="project"
            count={query.data?.length}
            isSyncing={sync.isPending}
            isError={sync.isError}
            error={sync.error}
            syncedAt={meta.data?.projectsSyncedAt}
            onSync={() => sync.mutate()}
            className="animate-in fade-in slide-in-from-left-4 duration-500 delay-100"
        />
    );
}

function TagsSection() {
    const query = useTags();
    const sync = useSyncTags();
    const meta = useSyncMeta();
    return (
        <SyncCard
            icon={Tags}
            title="Timetracker tags"
            description="Tags pulled from the Everit Timetracker plugin."
            itemNoun="tag"
            count={query.data?.length}
            isSyncing={sync.isPending}
            isError={sync.isError}
            error={sync.error}
            syncedAt={meta.data?.tagsSyncedAt}
            onSync={() => sync.mutate()}
            className="animate-in fade-in slide-in-from-right-4 duration-500 delay-200"
        />
    );
}

interface SyncCardProps {
    icon: LucideIcon;
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
    className?: string;
}

function SyncCard({
    icon: Icon,
    title,
    description,
    itemNoun,
    count,
    isSyncing,
    isError,
    error,
    syncedAt,
    onSync,
    className,
}: SyncCardProps) {
    return (
        <section
            aria-busy={isSyncing || undefined}
            aria-live="polite"
            className={cn(
                'relative flex flex-col overflow-hidden rounded-4xl border bg-muted/40',
                className,
            )}
        >
            <div className="relative flex flex-1 flex-col gap-5 p-5">
                <div className="flex items-start gap-3.5">
                    <div className="bg-primary/10 text-primary ring-primary/15 flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1">
                        <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="font-heading truncate font-medium">{title}</h2>
                        <p className="text-muted-foreground text-sm">{description}</p>
                    </div>
                    <FreshnessBadge
                        isError={isError}
                        syncedAt={syncedAt}
                        hasData={count !== undefined && count > 0}
                    />
                </div>

                <CountMetric itemNoun={itemNoun} count={count} syncedAt={syncedAt} />

                {isError ? <SyncError error={error} /> : null}

                <div className="mt-auto border-t pt-4">
                    <Button
                        variant={isError ? 'default' : 'outline'}
                        size="sm"
                        className="w-full"
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
                                {isError ? 'Retry sync' : 'Sync now'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </section>
    );
}

/**
 * The hero metric: the persisted count is the page's focal number. It comes
 * from the DB read and survives a failed sync, so we show it whenever present
 * and let any sync error render additively beside it.
 */
function CountMetric({
    itemNoun,
    count,
    syncedAt,
}: Pick<SyncCardProps, 'itemNoun' | 'count' | 'syncedAt'>) {
    if (count === undefined) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-10 w-20 rounded-xl" />
                <Skeleton className="h-3 w-28" />
            </div>
        );
    }

    if (count === 0) {
        return (
            <div>
                <p className="text-4xl font-semibold tracking-tight tabular-nums">0</p>
                <p className="text-muted-foreground mt-1 text-sm">
                    No {itemNoun}s yet — sync to pull them in.
                </p>
            </div>
        );
    }

    return (
        <div>
            <p className="flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                    {count}
                </span>
                <span className="text-muted-foreground text-sm">
                    {itemNoun}
                    {count === 1 ? '' : 's'}
                </span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
                {syncedAt ? (
                    <>Last synced {formatRelative(syncedAt)}</>
                ) : (
                    <em className="not-italic text-muted-foreground/70">Never synced</em>
                )}
            </p>
        </div>
    );
}

/**
 * At-a-glance sync health, reusing the connection-health palette: emerald when
 * freshly synced, amber when stale or never synced, destructive on a failed
 * sync.
 */
function FreshnessBadge({
    isError,
    syncedAt,
    hasData,
}: {
    isError: boolean;
    syncedAt: number | undefined;
    hasData: boolean;
}) {
    const base =
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium';

    if (isError) {
        return (
            <span
                className={cn(
                    base,
                    'border-destructive/30 bg-destructive/10 text-destructive',
                )}
            >
                <AlertCircle className="size-3" />
                Sync failed
            </span>
        );
    }

    if (!hasData || syncedAt === undefined) {
        return (
            <span className={cn(base, 'text-muted-foreground')}>Not synced</span>
        );
    }

    if (isStale(syncedAt)) {
        return (
            <span
                className={cn(
                    base,
                    'border-warning/30 bg-warning/10 text-warning',
                )}
            >
                <span className="size-2 rounded-full bg-warning" />
                Stale
            </span>
        );
    }

    return (
        <span
            className={cn(
                base,
                'border-success/30 bg-success/10 text-success',
            )}
        >
            <span className="size-2 rounded-full bg-success" />
            Synced
        </span>
    );
}

/** The error from the most recent failed sync, shown beneath any existing data. */
function SyncError({ error }: { error: unknown }) {
    const auth = error instanceof ApiError && error.isAuth;
    const detail = error instanceof Error ? error.message : String(error);
    return (
        <div className="border-destructive/20 bg-destructive/5 space-y-1 rounded-2xl border p-3">
            <p className="text-destructive text-sm font-medium">
                {auth
                    ? 'Token rejected — re-check your credentials.'
                    : "Couldn't sync. Check your connection and retry."}
            </p>
            {!auth ? (
                <details className="text-muted-foreground text-xs">
                    <summary className="cursor-pointer select-none">Show details</summary>
                    <p className="mt-1 break-words">{detail}</p>
                </details>
            ) : null}
        </div>
    );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Reference data older than a day is considered stale and worth re-syncing. */
function isStale(syncedAt: number): boolean {
    return Date.now() - syncedAt > DAY_MS;
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "5 minutes ago", "just now", … from a `syncedAt` timestamp. */
function formatRelative(timestamp: number): string {
    const seconds = Math.round((timestamp - Date.now()) / 1000);
    if (Math.abs(seconds) < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
    return relative.format(Math.round(hours / 24), 'day');
}
