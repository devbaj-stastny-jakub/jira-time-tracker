import { createFileRoute, redirect } from '@tanstack/react-router';
import { Timer } from 'lucide-react';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { loadCredentials } from '@/shared/credentials/credentials';
import { CredentialsForm } from '@/features/onboarding/CredentialsForm';
import { useCompleteOnboarding } from '@/features/onboarding/useOnboarding';

export const Route = createFileRoute('/onboarding')({
    beforeLoad: async () => {
        const credentials = await loadCredentials();
        if (credentials) {
            throw redirect({ to: '/' });
        }
    },
    component: OnboardingPage,
});

function OnboardingPage() {
    const complete = useCompleteOnboarding();

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
            {/* Cobalt glow pooling from the top, echoing the sidebar's wash. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-primary/10 mask-[radial-gradient(110%_70%_at_50%_-10%,black,transparent_60%)]"
            />
            {/* Faint engineering grid, faded out with a radial mask for depth. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-60 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-size-[26px_26px] mask-[radial-gradient(100%_80%_at_50%_0%,black,transparent_75%)]"
            />

            <div className="relative w-full max-w-lg">
                {/* Brand lockup — the same gradient mark the sidebar carries. */}
                <div className="animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-700 mb-7 flex flex-col items-center gap-3 text-center">
                    <div className="bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-primary/30 ring-primary/20 flex size-12 items-center justify-center rounded-2xl shadow-lg ring-1">
                        <Timer className="size-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="font-heading text-xl font-semibold tracking-tight">
                            Welcome to Timely
                        </span>
                        <span className="eyebrow">Jira time tracker</span>
                    </div>
                </div>

                <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 shadow-primary/5 w-full shadow-xl ring-1 ring-border">
                    <CardHeader>
                        <CardTitle className="font-heading text-lg tracking-tight">
                            Connect to Jira
                        </CardTitle>
                        <CardDescription>
                            One quick setup. Validation runs automatically when you save.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <CredentialsForm
                            stored={null}
                            submitLabel="Complete setup"
                            submittingLabel="Saving…"
                            isSubmitting={complete.isPending}
                            submitError={
                                complete.isError
                                    ? new Error(
                                          `Could not save credentials: ${complete.error.message}`,
                                      )
                                    : null
                            }
                            onSubmit={(credentials) => complete.mutate(credentials)}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
