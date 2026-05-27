import { useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Credentials } from '@/features/onboarding/credentials';
import { loadCredentials } from '@/features/onboarding/credentials';
import {
    useCompleteOnboarding,
    useValidateTokens,
} from '@/features/onboarding/useOnboarding';

export const Route = createFileRoute('/onboarding')({
    beforeLoad: async () => {
        const credentials = await loadCredentials();
        if (credentials) {
            throw redirect({ to: '/' });
        }
    },
    component: OnboardingPage,
});

const emptyForm: Credentials = {
    base_url: '',
    email: '',
    jira_token: '',
    timetracker_token: '',
};

function OnboardingPage() {
    const [form, setForm] = useState<Credentials>(emptyForm);
    const validate = useValidateTokens();
    const complete = useCompleteOnboarding();

    const report = validate.data;
    const validated = report?.allValid ?? false;

    // Any edit invalidates a previous validation result.
    function update(field: keyof Credentials, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
        validate.reset();
    }

    const filled =
        form.base_url.trim() !== '' &&
        form.email.trim() !== '' &&
        form.jira_token.trim() !== '' &&
        form.timetracker_token.trim() !== '';

    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Connect to Jira</CardTitle>
                    <CardDescription>
                        Enter your Jira connection details. Both tokens are validated
                        before the app is unlocked.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="base_url">Jira base URL</Label>
                        <Input
                            id="base_url"
                            placeholder="https://your-domain.atlassian.net"
                            value={form.base_url}
                            onChange={(e) => update('base_url', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Account email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={(e) => update('email', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="jira_token">Jira API token</Label>
                        <Input
                            id="jira_token"
                            type="password"
                            value={form.jira_token}
                            onChange={(e) => update('jira_token', e.target.value)}
                        />
                        {report ? <TokenStatus label="Jira token" ok={report.jira.ok} detail={report.jira.error ?? `HTTP ${report.jira.status}`} /> : null}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="timetracker_token">Timetracker token</Label>
                        <Input
                            id="timetracker_token"
                            type="password"
                            value={form.timetracker_token}
                            onChange={(e) => update('timetracker_token', e.target.value)}
                        />
                        {report ? <TokenStatus label="Timetracker token" ok={report.timetracker.ok} detail={report.timetracker.error ?? `HTTP ${report.timetracker.status}`} /> : null}
                    </div>
                </CardContent>

                <CardFooter className="flex-col gap-2">
                    <Button
                        className="w-full"
                        variant="outline"
                        disabled={!filled || validate.isPending}
                        onClick={() => validate.mutate(form)}
                    >
                        {validate.isPending ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Validating…
                            </>
                        ) : (
                            'Validate tokens'
                        )}
                    </Button>

                    <Button
                        className="w-full"
                        disabled={!validated || complete.isPending}
                        onClick={() => complete.mutate(form)}
                    >
                        {complete.isPending ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            'Complete setup'
                        )}
                    </Button>

                    {complete.isError ? (
                        <p className="text-destructive text-sm">
                            Could not save credentials: {complete.error.message}
                        </p>
                    ) : null}
                </CardFooter>
            </Card>
        </div>
    );
}

function TokenStatus({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
    return (
        <p
            className={`flex items-center gap-1.5 text-sm ${
                ok ? 'text-green-600' : 'text-destructive'
            }`}
        >
            {ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            {ok ? `${label} valid` : `${label} invalid (${detail})`}
        </p>
    );
}
