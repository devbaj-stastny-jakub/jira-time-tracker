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
    return (
        <div className="space-y-6">
            <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                    Workspace
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Reference data pulled from Jira. Sync to keep your projects and
                    tags current.
                </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
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
            delay="delay-75"
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
            delay="delay-150"
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
    /** Tailwind animation-delay class for the staggered entrance. */
    delay: string;
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
    delay,
}: SyncCardProps) {
    return (
        <section
            className={cn(
                'animate-in fade-in slide-in-from-bottom-3 fill-mode-both relative flex flex-col overflow-hidden rounded-4xl border duration-500',
                delay,
            )}
        >
            {/* Cobalt wash + faint grid for depth, echoing the identity banner. */}
            <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-primary/12 via-primary/4 to-transparent"
            />
            <div
                aria-hidden
                className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(120%_120%_at_90%_0%,black,transparent_65%)]"
            />

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
                        variant="outline"
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
                <p className="text-3xl font-semibold tracking-tight tabular-nums">0</p>
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
                Last synced {formatRelative(syncedAt)}
            </p>
        </div>
    );
}

/**
 * At-a-glance sync health, reusing the connection-health palette: emerald when
 * freshly synced, amber when stale or never synced, destructive on a failed
 * sync. Only the fresh state pulses.
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
                    'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                )}
            >
                <span className="size-2 rounded-full bg-amber-500" />
                Stale
            </span>
        );
    }

    return (
        <span
            className={cn(
                base,
                'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
        >
            <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
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
                <p className="text-muted-foreground text-xs break-all">{detail}</p>
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
