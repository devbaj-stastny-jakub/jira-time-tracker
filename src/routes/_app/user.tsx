import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
    AlertCircle,
    ExternalLink,
    Loader2,
    LogOut,
    Monitor,
    Moon,
    RefreshCw,
    Sun,
} from 'lucide-react';

import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCredentials } from '@/shared/credentials/useCredentials';
import { CredentialsForm } from '@/features/onboarding/CredentialsForm';
import {
    useCurrentUser,
    useSignOut,
    useUpdateCredentials,
} from '@/features/onboarding/useOnboarding';

export const Route = createFileRoute('/_app/user')({
    component: UserPage,
});

function UserPage() {
    const { data: credentials } = useCredentials();
    const update = useUpdateCredentials();
    // Bumped on a successful save to remount the form: it re-reads the freshly
    // stored values, clears the token fields back to blank, and resets Save.
    const [formKey, setFormKey] = useState(0);

    return (
        <div className="space-y-6">
            <header className="animate-in fade-in slide-in-from-top-3 duration-500">
                <h1 className="text-2xl font-semibold tracking-tight">Your connection</h1>
            </header>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <IdentityCard />
            </div>

            <Card size="sm" className="animate-in fade-in slide-in-from-left-4 duration-500 delay-200">
                <CardContent className="pt-6">
                    {credentials ? (
                        <CredentialsForm
                            key={formKey}
                            stored={credentials}
                            submitLabel="Save changes"
                            submittingLabel="Saving…"
                            isSubmitting={update.isPending}
                            submitError={null}
                            onSubmit={(next) =>
                                update.mutate(next, {
                                    onSuccess: () => {
                                        toast.success('Credentials updated', {
                                            description:
                                                'Your connection details are saved.',
                                        });
                                        setFormKey((k) => k + 1);
                                    },
                                    onError: (error) =>
                                        toast.error("Couldn't save credentials", {
                                            description: error.message,
                                        }),
                                })
                            }
                        />
                    ) : (
                        <FormSkeleton />
                    )}
                </CardContent>
            </Card>

            <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-300">
                <Appearance />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-500">
                <DangerZone />
            </div>
        </div>
    );
}

/**
 * Theme picker: Light / Dark / System. Persists via next-themes' localStorage
 * and applies the `.dark` class on `<html>` so the CSS tokens swap.
 */
function Appearance() {
    const { theme, setTheme } = useTheme();
    const current = theme ?? 'system';
    const options = [
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
        { value: 'system', label: 'System', icon: Monitor },
    ] as const;

    return (
        <section aria-labelledby="appearance-heading" className="space-y-3">
            <div>
                <h2 id="appearance-heading" className="text-sm font-semibold">
                    Appearance
                </h2>
                <p className="text-muted-foreground text-xs">
                    Match the system, or pin a theme.
                </p>
            </div>
            <div
                role="radiogroup"
                aria-labelledby="appearance-heading"
                className="grid grid-cols-3 gap-2"
            >
                {options.map(({ value, label, icon: Icon }) => {
                    const active = current === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setTheme(value)}
                            className={cn(
                                'flex flex-col items-center gap-2 rounded-2xl border p-3 text-sm transition-colors',
                                active
                                    ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                            )}
                        >
                            <Icon className="size-5" />
                            {label}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

/**
 * Live identity banner: who Jira thinks you are right now, against which
 * tenant. Doubles as connection health — a failed `/myself` surfaces here
 * immediately with a retry path.
 */
function IdentityCard() {
    const { data: credentials } = useCredentials();
    const { data: user, isPending, isError, error, refetch, isFetching } = useCurrentUser();

    const name = user?.displayName ?? (isError ? 'Not connected' : 'Loading…');
    const detail = user?.emailAddress ?? (isError ? 'Authentication failed' : '');
    const host = (() => {
        if (!credentials?.base_url) return null;
        try {
            return new URL(credentials.base_url).host;
        } catch {
            return credentials.base_url;
        }
    })();

    const errorMessage = isError
        ? (error instanceof Error ? error.message : String(error)).replace(
              /^Jira \/myself returned /,
              '',
          )
        : null;

    return (
        <div className="relative overflow-hidden rounded-2xl border">
            {/* Decorative wash — gradient shifts to destructive when something's
                wrong so the surface itself reports health. pointer-events-none
                so it never intercepts clicks on overlaid content. */}
            <div
                aria-hidden
                className={cn(
                    'pointer-events-none absolute inset-0 bg-gradient-to-br',
                    isError
                        ? 'from-destructive/15 via-destructive/5 to-transparent'
                        : 'from-primary/15 via-primary/5 to-transparent',
                )}
            />

            <div className="relative flex items-center gap-4 p-5">
                <Avatar size="lg" className="ring-2 ring-background">
                    {user?.avatarUrls?.['48x48'] ? (
                        <AvatarImage src={user.avatarUrls['48x48']} alt={user.displayName} />
                    ) : null}
                    <AvatarFallback className="bg-primary/12 text-primary font-medium">
                        {user ? initials(user.displayName) : <UserGlyph />}
                    </AvatarFallback>
                    <AvatarBadge
                        role="status"
                        aria-label={
                            isError ? 'Disconnected' : user ? 'Connected' : 'Connecting'
                        }
                        className={cn(
                            isError
                                ? 'bg-destructive'
                                : user
                                  ? 'bg-success'
                                  : 'bg-warning',
                        )}
                    />
                </Avatar>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">{name}</p>
                    {detail ? (
                        <p className="text-muted-foreground truncate text-sm">{detail}</p>
                    ) : null}
                    {host ? (
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground/80">
                            {host}
                        </p>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    <ConnectionBadge
                        isPending={isPending || isFetching}
                        isError={isError}
                        connected={!!user}
                    />
                    {isError ? (
                        <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="Retry connection"
                            onClick={() => refetch()}
                        >
                            <RefreshCw />
                        </Button>
                    ) : null}
                </div>
            </div>

            {isError && errorMessage ? (
                <div className="relative border-t bg-destructive/5 px-5 py-3 text-xs text-destructive/90">
                    {errorMessage}
                </div>
            ) : null}
        </div>
    );
}

function ConnectionBadge({
    isPending,
    isError,
    connected,
}: {
    isPending: boolean;
    isError: boolean;
    connected: boolean;
}) {
    if (isError) {
        return (
            <Badge variant="destructive" className="gap-1.5">
                <AlertCircle />
                Disconnected
            </Badge>
        );
    }
    if (connected) {
        return (
            <Badge
                variant="outline"
                className="gap-1.5 border-success/30 bg-success/10 text-success"
            >
                <span className="size-2 rounded-full bg-success" />
                {isPending ? 'Refreshing…' : 'Connected'}
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="text-muted-foreground gap-1.5">
            <Loader2 className="size-3 animate-spin" />
            Connecting
        </Badge>
    );
}

/**
 * Sign-out / disconnect. Two-step confirmation since it wipes credentials and
 * forces the user back through onboarding to come back in.
 */
function DangerZone() {
    const [confirming, setConfirming] = useState(false);
    const signOut = useSignOut();

    return (
        <section
            aria-labelledby="danger-zone-heading"
            className="space-y-3 rounded-2xl border border-destructive/20 bg-destructive/[0.02] p-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 id="danger-zone-heading" className="text-sm font-semibold text-destructive">
                        Disconnect
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        Wipes credentials from the keychain and signs you out.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirming(true)}
                >
                    <LogOut />
                    Disconnect
                </Button>
            </div>

            {confirming ? (
                <Dialog open onOpenChange={(open) => !open && setConfirming(false)}>
                    <DialogContent showCloseButton={false} className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Disconnect from Jira?</DialogTitle>
                            <DialogDescription>
                                Your stored credentials will be removed from the keychain
                                and you&rsquo;ll be signed out. Local time records and
                                synced reference data are kept.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setConfirming(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={signOut.isPending}
                                onClick={() => signOut.mutate()}
                            >
                                <LogOut />
                                Disconnect
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            ) : null}
        </section>
    );
}

function FormSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full rounded-4xl" />
            <Skeleton className="h-9 w-full rounded-4xl" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full rounded-4xl" />
            <Skeleton className="h-9 w-full rounded-4xl" />
        </div>
    );
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function UserGlyph() {
    return <ExternalLink className="size-4" />;
}
