import { useState } from 'react';
import { toast } from 'sonner';
import {
    AtSign,
    CheckCircle2,
    Clock,
    Copy,
    Eye,
    EyeOff,
    Layers,
    Link2,
    Loader2,
    Lock,
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
import { cn } from '@/lib/utils';
import type { Credentials } from '@/shared/credentials/credentials';
import { useValidateTokens } from './useOnboarding';

const JIRA_TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

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

/** Normalize a base URL: trim, lower-case scheme, prepend https://, strip trailing slash. */
function normalizeBaseUrl(input: string): string {
    let v = input.trim();
    if (!v) return v;
    if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
    return v.replace(/\/+$/, '');
}

/** Map an HTTP status / network error into a one-line human cause. */
function explainTokenFailure(status: number | undefined, error: string | undefined): string {
    if (error) return 'Could not reach the server — check your connection';
    if (status === 401 || status === 403)
        return 'Token rejected — check the token and email match the same Jira account';
    if (status === 404) return 'URL not found — verify the Jira base URL';
    if (status && status >= 500) return 'Server error — try again in a moment';
    return `HTTP ${status ?? 'unknown'}`;
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

    // Any edit invalidates a previous validation result.
    function update(field: keyof typeof form, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
        validate.reset();
    }

    function handleBaseUrlBlur() {
        const next = normalizeBaseUrl(form.base_url);
        if (next !== form.base_url) {
            setForm((prev) => ({ ...prev, base_url: next }));
            validate.reset();
        }
    }

    // Single-button flow: validate first, save only if both tokens pass. Editing
    // with no diff is gated by `changed`; onboarding is gated only by `filled`.
    const isBusy = isSubmitting || validate.isPending;
    const canSubmit = filled && changed && !isBusy;

    async function handleSubmit() {
        const result = await validate.mutateAsync(effective);
        if (result.allValid) {
            onSubmit(effective);
        }
    }

    const disabledReason = !filled
        ? 'Fill all fields to continue'
        : !changed
          ? 'Edit a field to enable saving'
          : undefined;

    return (
        <div className="space-y-6">
            <Section
                eyebrow="Instance"
                title="Where your Jira lives"
                description="The Atlassian Cloud URL of your workspace, and the email of the account that generated the token below."
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
                            onBlur={handleBaseUrlBlur}
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
                    <p className="text-muted-foreground text-xs">
                        Must match the Jira account that owns the API token.
                    </p>
                </div>
            </Section>

            <Section
                eyebrow="Tokens"
                title="Two API tokens, two jobs"
                description="The Jira token reads your projects and issues. The Timetracker token writes worklogs into the Everit plugin."
            >
                <TrustPill />

                <TokenField
                    id="jira_token"
                    label="Jira API token"
                    icon={Layers}
                    placeholder={stored ? 'Leave blank to keep current' : 'ATATT…'}
                    value={form.jira_token}
                    revealed={reveal.jira}
                    onReveal={() => setReveal((r) => ({ ...r, jira: !r.jira }))}
                    onChange={(v) => update('jira_token', v)}
                    helper={
                        <CopyableLink
                            url={JIRA_TOKEN_URL}
                            label="Create a Jira API token →"
                        />
                    }
                    status={
                        report ? (
                            <TokenStatus
                                ok={report.jira.ok}
                                detail={explainTokenFailure(
                                    report.jira.status,
                                    report.jira.error,
                                )}
                            />
                        ) : null
                    }
                />

                <TokenField
                    id="timetracker_token"
                    label="Timetracker token"
                    icon={Clock}
                    placeholder={stored ? 'Leave blank to keep current' : ''}
                    value={form.timetracker_token}
                    revealed={reveal.timetracker}
                    onReveal={() =>
                        setReveal((r) => ({ ...r, timetracker: !r.timetracker }))
                    }
                    onChange={(v) => update('timetracker_token', v)}
                    helper={
                        <p className="text-muted-foreground text-xs">
                            Generate from the Everit Timetracker plugin&rsquo;s settings inside Jira.
                        </p>
                    }
                    status={
                        report ? (
                            <TokenStatus
                                ok={report.timetracker.ok}
                                detail={explainTokenFailure(
                                    report.timetracker.status,
                                    report.timetracker.error,
                                )}
                            />
                        ) : null
                    }
                />
            </Section>

            <div className="flex flex-col gap-3 border-t pt-5">
                <Button
                    className="w-full"
                    disabled={!canSubmit}
                    title={disabledReason}
                    onClick={handleSubmit}
                >
                    {isBusy ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            {validate.isPending ? 'Validating…' : submittingLabel}
                        </>
                    ) : (
                        <>
                            <ShieldCheck className="size-4" />
                            {submitLabel}
                        </>
                    )}
                </Button>

                {disabledReason && !isBusy ? (
                    <p className="text-muted-foreground text-xs">{disabledReason}</p>
                ) : null}

                <div role="status" aria-live="polite">
                    {submitError ? (
                        <p className="text-destructive text-sm" role="alert">
                            {submitError.message}
                        </p>
                    ) : null}
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">
                    Requests go only to your Jira and the Everit Timetracker — nothing
                    else leaves your machine.
                </p>
            </div>
        </div>
    );
}

/** Visible badge promoting the keychain claim — the audit's #1 trust signal. */
function TrustPill() {
    return (
        <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/8 px-3 py-1.5 text-xs text-success">
            <Lock className="size-3.5" />
            <span>Stored in your OS keychain — never written to disk in plain text.</span>
        </div>
    );
}

/**
 * URL the user should visit to manage their tokens. Tauri webviews don't open
 * external links by default and we don't ship the shell plugin, so the link
 * copies to clipboard on click instead.
 */
function CopyableLink({ url, label }: { url: string; label: string }) {
    return (
        <button
            type="button"
            onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success('Link copied', { description: url });
            }}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded"
        >
            <Copy className="size-3" />
            {label}
        </button>
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
        <section className="space-y-3">
            <div className="space-y-1">
                <span className="eyebrow text-primary">{eyebrow}</span>
                <h3 className="text-sm leading-snug font-medium">{title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
            </div>
            {children}
        </section>
    );
}

function TokenField({
    id,
    label,
    icon: Icon,
    placeholder,
    value,
    revealed,
    onReveal,
    onChange,
    helper,
    status,
}: {
    id: string;
    label: string;
    icon: typeof Layers;
    placeholder?: string;
    value: string;
    revealed: boolean;
    onReveal: () => void;
    onChange: (value: string) => void;
    helper?: React.ReactNode;
    status: React.ReactNode;
}) {
    const ok = status === null ? undefined : isValidStatus(status);
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <InputGroup>
                <InputGroupAddon>
                    <Icon className="text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                    id={id}
                    type={revealed ? 'text' : 'password'}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-invalid={ok === false}
                    aria-describedby={status ? `${id}-status` : undefined}
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
            {status ? <div id={`${id}-status`}>{status}</div> : null}
            {helper}
        </div>
    );
}

/** Heuristic to extract ok/not-ok from a TokenStatus React node for aria-invalid. */
function isValidStatus(node: React.ReactNode): boolean | undefined {
    if (!node || typeof node !== 'object' || !('props' in node)) return undefined;
    const props = node.props as { ok?: boolean } | undefined;
    return props?.ok;
}

function TokenStatus({ ok, detail }: { ok: boolean; detail: string }) {
    return (
        <p
            className={cn(
                'flex items-center gap-1.5 text-xs',
                ok ? 'text-success' : 'text-destructive',
            )}
        >
            {ok ? (
                <CheckCircle2 className="size-3.5" />
            ) : (
                <XCircle className="size-3.5" />
            )}
            {ok ? 'Valid' : detail}
        </p>
    );
}
