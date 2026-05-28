import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Avatar, AvatarBadge, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCredentials } from '@/shared/credentials/useCredentials';
import { CredentialsForm } from '@/features/onboarding/CredentialsForm';
import {
    useCurrentUser,
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
            <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                    Account
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                    Your connection
                </h1>
            </header>

            <IdentityCard />

            <Card
                className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both delay-150 duration-500"
                size="sm"
            >
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
        </div>
    );
}

/**
 * Live identity banner: who Jira thinks you are right now. Doubles as a
 * connection health indicator — a failed `/myself` surfaces here immediately.
 */
function IdentityCard() {
    const { data: user, isPending, isError } = useCurrentUser();

    const name = user?.displayName ?? (isError ? 'Not connected' : 'Loading…');
    const detail = user?.emailAddress ?? (isError ? 'Check your credentials below' : '');

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both relative overflow-hidden rounded-2xl border delay-75 duration-500">
            {/* Cobalt wash + faint grid for depth without stealing focus. */}
            <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent"
            />
            <div
                aria-hidden
                className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(120%_120%_at_85%_0%,black,transparent_70%)]"
            />

            <div className="relative flex items-center gap-4 p-5">
                <Avatar size="lg" className="ring-2 ring-background">
                    <AvatarFallback className="bg-primary/12 text-primary font-medium">
                        {user ? initials(user.displayName) : <UserGlyph />}
                    </AvatarFallback>
                    <AvatarBadge
                        className={cn(
                            isError
                                ? 'bg-destructive'
                                : user
                                  ? 'bg-emerald-500'
                                  : 'bg-amber-500',
                        )}
                    />
                </Avatar>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">{name}</p>
                    {detail ? (
                        <p className="text-muted-foreground truncate text-sm">{detail}</p>
                    ) : null}
                </div>

                <ConnectionBadge
                    isPending={isPending}
                    isError={isError}
                    connected={!!user}
                />
            </div>
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
                className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
                <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Connected
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="text-muted-foreground gap-1.5">
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Connecting
        </Badge>
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
    return <span className="text-sm">··</span>;
}
