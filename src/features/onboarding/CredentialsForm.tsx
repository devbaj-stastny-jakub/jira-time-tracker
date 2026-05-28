import { useState } from 'react';
import {
    AtSign,
    CheckCircle2,
    Eye,
    EyeOff,
    KeyRound,
    Link2,
    Loader2,
    ShieldCheck,
    XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import type { Credentials } from '@/shared/credentials/credentials';
import { useValidateTokens } from './useOnboarding';

interface CredentialsFormProps {
    /**
     * Credentials currently stored in the keychain, or `null` during onboarding
     * (nothing stored yet). When set, `base_url`/`email` are prefilled and empty
     * token fields mean "keep the stored token" — the secret is never rendered
     * back into the DOM. Editing requires a real change before submit unlocks.
     */
    stored: Credentials | null;
    submitLabel: string;
    submittingLabel: string;
    isSubmitting: boolean;
    /** Inline error shown beneath the submit button; pass `null` to suppress. */
    submitError: Error | null;
    /** Receives the effective (typed-over-stored) credentials. */
    onSubmit: (credentials: Credentials) => void;
}

export function CredentialsForm({
    stored,
    submitLabel,
    submittingLabel,
    isSubmitting,
    submitError,
    onSubmit,
}: CredentialsFormProps) {
    // Tokens always start blank so a stored secret never re-enters the DOM;
    // base_url/email are prefilled because they're not secret and usually kept.
    const [form, setForm] = useState({
        base_url: stored?.base_url ?? '',
        email: stored?.email ?? '',
        jira_token: '',
        timetracker_token: '',
    });
    const [reveal, setReveal] = useState({ jira: false, timetracker: false });
    const validate = useValidateTokens();

    // Effective credentials: a typed value wins, otherwise fall back to stored.
    // This is what we validate and submit, so "Validate" tests the new token
    // when one is typed and confirms the current token when left blank.
    const effective: Credentials = {
        base_url: form.base_url.trim() || stored?.base_url || '',
        email: form.email.trim() || stored?.email || '',
        jira_token: form.jira_token.trim() || stored?.jira_token || '',
        timetracker_token:
            form.timetracker_token.trim() || stored?.timetracker_token || '',
    };

    const filled =
        effective.base_url !== '' &&
        effective.email !== '' &&
        effective.jira_token !== '' &&
        effective.timetracker_token !== '';

    // Onboarding (no stored creds) is always a "change". When editing, require a
    // real diff so Save reflects intent and can't persist a no-op.
    const changed =
        !stored ||
        effective.base_url !== stored.base_url ||
        effective.email !== stored.email ||
        effective.jira_token !== stored.jira_token ||
        effective.timetracker_token !== stored.timetracker_token;

    const report = validate.data;
    const validated = report?.allValid ?? false;

    // Any edit invalidates a previous validation result.
    function update(field: keyof typeof form, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
        validate.reset();
    }

    const keepHint = stored ? 'Leave blank to keep current' : undefined;

    return (
        <div className="space-y-7">
            <Section
                eyebrow="Instance"
                title="Where your Jira lives"
                description="The base URL and the account email used to sign requests."
            >
                <div className="space-y-2">
                    <Label htmlFor="base_url">Jira base URL</Label>
                    <InputGroup>
                        <InputGroupAddon>
                            <Link2 className="text-muted-foreground" />
                        </InputGroupAddon>
                        <InputGroupInput
                            id="base_url"
                            placeholder="https://your-domain.atlassian.net"
                            value={form.base_url}
                            onChange={(e) => update('base_url', e.target.value)}
                        />
                    </InputGroup>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Account email</Label>
                    <InputGroup>
                        <InputGroupAddon>
                            <AtSign className="text-muted-foreground" />
                        </InputGroupAddon>
                        <InputGroupInput
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={(e) => update('email', e.target.value)}
                        />
                    </InputGroup>
                </div>
            </Section>

            <Section
                eyebrow="Authentication"
                title="Your secret keys"
                description="Stored in your OS keychain — never written to disk in plain text."
            >
                <TokenField
                    id="jira_token"
                    label="Jira API token"
                    placeholder={keepHint}
                    value={form.jira_token}
                    revealed={reveal.jira}
                    onReveal={() => setReveal((r) => ({ ...r, jira: !r.jira }))}
                    onChange={(v) => update('jira_token', v)}
                    status={
                        report ? (
                            <TokenStatus
                                ok={report.jira.ok}
                                detail={report.jira.error ?? `HTTP ${report.jira.status}`}
                            />
                        ) : null
                    }
                />

                <TokenField
                    id="timetracker_token"
                    label="Timetracker token"
                    placeholder={keepHint}
                    value={form.timetracker_token}
                    revealed={reveal.timetracker}
                    onReveal={() =>
                        setReveal((r) => ({ ...r, timetracker: !r.timetracker }))
                    }
                    onChange={(v) => update('timetracker_token', v)}
                    status={
                        report ? (
                            <TokenStatus
                                ok={report.timetracker.ok}
                                detail={
                                    report.timetracker.error ??
                                    `HTTP ${report.timetracker.status}`
                                }
                            />
                        ) : null
                    }
                />
            </Section>

            <div className="flex flex-col gap-3 border-t pt-5">
                <div className="flex gap-2">
                    <Button
                        className="flex-1"
                        variant="outline"
                        disabled={!filled || validate.isPending}
                        onClick={() => validate.mutate(effective)}
                    >
                        {validate.isPending ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Validating…
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="size-4" />
                                Validate tokens
                            </>
                        )}
                    </Button>

                    <Button
                        className="flex-1"
                        disabled={!validated || !changed || isSubmitting}
                        onClick={() => onSubmit(effective)}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                {submittingLabel}
                            </>
                        ) : (
                            submitLabel
                        )}
                    </Button>
                </div>

                <p className="text-muted-foreground text-xs">
                    {validated
                        ? changed
                            ? 'Looks good — save when ready.'
                            : 'Validated. Edit a field to enable saving.'
                        : 'Validate your tokens to unlock saving.'}
                </p>

                {submitError ? (
                    <p className="text-destructive text-sm">{submitError.message}</p>
                ) : null}
            </div>
        </div>
    );
}

function Section({
    eyebrow,
    title,
    description,
    children,
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-4">
            <div className="space-y-1">
                <span className="text-primary text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
                    {eyebrow}
                </span>
                <h3 className="text-sm leading-none font-medium">{title}</h3>
                <p className="text-muted-foreground text-xs">{description}</p>
            </div>
            {children}
        </section>
    );
}

function TokenField({
    id,
    label,
    placeholder,
    value,
    revealed,
    onReveal,
    onChange,
    status,
}: {
    id: string;
    label: string;
    placeholder?: string;
    value: string;
    revealed: boolean;
    onReveal: () => void;
    onChange: (value: string) => void;
    status: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <InputGroup>
                <InputGroupAddon>
                    <KeyRound className="text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                    id={id}
                    type={revealed ? 'text' : 'password'}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                    <InputGroupButton
                        size="icon-xs"
                        aria-label={revealed ? 'Hide token' : 'Show token'}
                        onClick={onReveal}
                    >
                        {revealed ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
            {status}
        </div>
    );
}

function TokenStatus({ ok, detail }: { ok: boolean; detail: string }) {
    return (
        <p
            className={`flex items-center gap-1.5 text-xs ${
                ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
            }`}
        >
            {ok ? (
                <CheckCircle2 className="size-3.5" />
            ) : (
                <XCircle className="size-3.5" />
            )}
            {ok ? 'Valid' : `Invalid (${detail})`}
        </p>
    );
}
